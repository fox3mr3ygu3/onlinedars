import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@onlinedars/shared';
import type { Order, Payment, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OrderFulfillmentService } from '../core/order-fulfillment.service';
import { getRefundPolicy, lockOrder, parseOrderNumber, type Tx } from '../core/payments-db';
import { isRecord, safeEqual } from '../core/secure-compare';
import {
  PAYME_ACCOUNT_FIELD,
  PAYME_MESSAGES,
  PAYME_REASON_TIMEOUT,
  PAYME_TX_TIMEOUT_MS,
  PaymeErrorCode,
  PaymeRpcError,
  PaymeState,
} from './payme.errors';

export type PaymeResponse =
  | { id: unknown; result: unknown }
  | {
      id: unknown;
      error: { code: number; message: { ru: string; uz: string; en: string }; data?: string };
    };

const txIdParams = z.object({ id: z.string().min(1).max(64) });
const createParams = txIdParams.extend({
  time: z.number().int().positive(),
  amount: z.unknown(),
  account: z.unknown(),
});
const checkPerformParams = z.object({ amount: z.unknown(), account: z.unknown() });
const cancelParams = txIdParams.extend({ reason: z.number().int() });
const statementParams = z.object({ from: z.number().int().min(0), to: z.number().int().min(0) });

const ms = (d: Date | null | undefined): number => (d ? d.getTime() : 0);

/** Our payment status → Payme transaction state. */
export function paymeStateOf(p: Pick<Payment, 'status' | 'performedAt'>): PaymeState {
  switch (p.status) {
    case PaymentStatus.PENDING:
      return PaymeState.CREATED;
    case PaymentStatus.PAID:
      return PaymeState.PERFORMED;
    case PaymentStatus.REFUNDED:
      return PaymeState.CANCELLED_AFTER_PERFORM;
    default:
      return p.performedAt ? PaymeState.CANCELLED_AFTER_PERFORM : PaymeState.CANCELLED;
  }
}

function parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const r = schema.safeParse(params);
  if (!r.success) throw new PaymeRpcError(PaymeErrorCode.INVALID_REQUEST);
  return r.data;
}

/**
 * Payme Merchant API (JSON-RPC over POST, Basic auth `Paycom:<PAYME_KEY>`).
 * Every response is HTTP 200. Amounts are tiyin. `account.order_id` is our Order.number.
 * Idempotency: Payment is unique on (PAYME, Payme transaction id); repeated Create/Perform/
 * Cancel return the stored result; the order row is locked while a callback runs.
 */
@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Checks `Authorization: Basic base64("Paycom:<key>")` in constant time. */
  isAuthorized(header: string | undefined): boolean {
    const key = this.config.env.PAYME_KEY;
    if (!key || !header) return false;
    const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header.trim());
    if (!m?.[1]) return false;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep < 0) return false;
    const login = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);
    return safeEqual(login, 'Paycom') && safeEqual(password, key);
  }

  async handle(
    authHeader: string | undefined,
    body: unknown,
    now: Date = new Date(),
  ): Promise<PaymeResponse> {
    const id = isRecord(body) && 'id' in body ? body.id : null;
    try {
      if (!this.isAuthorized(authHeader)) {
        throw new PaymeRpcError(PaymeErrorCode.INSUFFICIENT_PRIVILEGE);
      }
      if (!isRecord(body) || typeof body.method !== 'string' || !isRecord(body.params)) {
        throw new PaymeRpcError(PaymeErrorCode.INVALID_REQUEST);
      }
      const result = await this.dispatch(body.method, body.params, now);
      return { id, result };
    } catch (err) {
      if (err instanceof PaymeRpcError) return this.errorResponse(id, err);
      this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      return this.errorResponse(id, new PaymeRpcError(PaymeErrorCode.SYSTEM_ERROR));
    }
  }

  errorResponse(id: unknown, err: PaymeRpcError): PaymeResponse {
    return {
      id,
      error: {
        code: err.code,
        message: PAYME_MESSAGES[err.code],
        ...(err.data ? { data: err.data } : {}),
      },
    };
  }

  private dispatch(method: string, params: Record<string, unknown>, now: Date): Promise<unknown> {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerformTransaction(params, now);
      case 'CreateTransaction':
        return this.createTransaction(params, now);
      case 'PerformTransaction':
        return this.performTransaction(params, now);
      case 'CancelTransaction':
        return this.cancelTransaction(params, now);
      case 'CheckTransaction':
        return this.checkTransaction(params);
      case 'GetStatement':
        return this.getStatement(params);
      default:
        // Includes ChangePassword: the key lives in env (PAYME_KEY), so it can't be changed here.
        throw new PaymeRpcError(PaymeErrorCode.METHOD_NOT_FOUND);
    }
  }

  // ── methods ──

  async checkPerformTransaction(params: unknown, now: Date): Promise<unknown> {
    const p = parseParams(checkPerformParams, params);
    const order = await this.findOrder(this.prisma, p.account);
    await this.assertPayable(this.prisma, order, p.amount, now);
    const detail = await this.receiptDetail(order);
    return { allow: true, ...(detail ? { detail } : {}) };
  }

  async createTransaction(params: unknown, now: Date): Promise<unknown> {
    const p = parseParams(createParams, params);
    return this.inTx(async (tx) => {
      const existing = await this.findTx(tx, p.id);
      if (existing) {
        await lockOrder(tx, existing.orderId);
        const pay = await tx.payment.findUniqueOrThrow({ where: { id: existing.id } });
        if (pay.status !== PaymentStatus.PENDING) {
          throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
        }
        if (this.isTimedOut(pay, now)) {
          await this.cancelAsTimedOut(tx, pay, now);
          throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
        }
        return { create_time: ms(pay.createdAt), transaction: pay.id, state: PaymeState.CREATED };
      }

      const found = await this.findOrder(tx, p.account);
      await lockOrder(tx, found.id);
      const order = await tx.order.findUniqueOrThrow({ where: { id: found.id } });
      const amount = await this.assertPayable(tx, order, p.amount, now);
      if (now.getTime() - p.time >= PAYME_TX_TIMEOUT_MS) {
        throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
      }
      const busy = await tx.payment.count({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
      });
      if (busy > 0) throw new PaymeRpcError(PaymeErrorCode.ORDER_BUSY, PAYME_ACCOUNT_FIELD);

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.PAYME,
          providerTransactionId: p.id,
          amount,
          currency: order.currency,
          status: PaymentStatus.PENDING,
          providerCreatedAt: BigInt(p.time),
          raw: { method: 'CreateTransaction', params } as Prisma.InputJsonValue,
          createdAt: now,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { provider: PaymentProvider.PAYME } });
      return { create_time: now.getTime(), transaction: payment.id, state: PaymeState.CREATED };
    });
  }

  async performTransaction(params: unknown, now: Date): Promise<unknown> {
    const p = parseParams(txIdParams, params);
    let notificationId: string | undefined;
    const result = await this.inTx(async (tx) => {
      const found = await this.findTx(tx, p.id);
      if (!found) throw new PaymeRpcError(PaymeErrorCode.TRANSACTION_NOT_FOUND);
      await lockOrder(tx, found.orderId);
      const pay = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });

      if (pay.status === PaymentStatus.PAID) {
        // Repeated Perform: same answer, nothing granted again.
        return {
          transaction: pay.id,
          perform_time: ms(pay.performedAt),
          state: PaymeState.PERFORMED,
        };
      }
      if (pay.status !== PaymentStatus.PENDING)
        throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
      if (this.isTimedOut(pay, now)) {
        await this.cancelAsTimedOut(tx, pay, now);
        throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: pay.orderId } });
      if (order.status !== PaymentStatus.PENDING) {
        throw new PaymeRpcError(PaymeErrorCode.CANNOT_PERFORM);
      }

      await tx.payment.update({
        where: { id: pay.id },
        data: { status: PaymentStatus.PAID, performedAt: now },
      });
      const paid = await this.fulfillment.markPaid(tx, order.id, {
        provider: PaymentProvider.PAYME,
        now,
      });
      notificationId = paid.notificationId;
      return { transaction: pay.id, perform_time: now.getTime(), state: PaymeState.PERFORMED };
    });
    if (notificationId) void this.notifications.deliver(notificationId);
    return result;
  }

  async cancelTransaction(params: unknown, now: Date): Promise<unknown> {
    const p = parseParams(cancelParams, params);
    return this.inTx(async (tx) => {
      const found = await this.findTx(tx, p.id);
      if (!found) throw new PaymeRpcError(PaymeErrorCode.TRANSACTION_NOT_FOUND);
      await lockOrder(tx, found.orderId);
      const pay = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });

      if (pay.status === PaymentStatus.PENDING) {
        // Before perform: the order stays PENDING so the student can pay again.
        await tx.payment.update({
          where: { id: pay.id },
          data: { status: PaymentStatus.CANCELLED, cancelledAt: now, cancelReason: p.reason },
        });
        return { transaction: pay.id, cancel_time: now.getTime(), state: PaymeState.CANCELLED };
      }

      if (pay.status === PaymentStatus.PAID) {
        // After perform = refund. Access is revoked or kept per the REFUND_POLICY setting.
        const policy = await getRefundPolicy(tx);
        await tx.payment.update({
          where: { id: pay.id },
          data: { status: PaymentStatus.REFUNDED, cancelledAt: now, cancelReason: p.reason },
        });
        const refund = await this.fulfillment.markRefunded(tx, pay.orderId, policy, now);
        await this.audit.log(
          {
            actorId: null,
            action: 'payment.refund',
            entityType: 'Order',
            entityId: pay.orderId,
            before: { status: PaymentStatus.PAID, paymentId: pay.id },
            after: {
              status: refund.changed ? PaymentStatus.REFUNDED : undefined,
              paymentStatus: PaymentStatus.REFUNDED,
              accessRevoked: refund.accessRevoked,
              refundPolicy: policy,
            },
            reason: `Payme CancelTransaction, reason ${p.reason}`,
          },
          tx,
        );
        return {
          transaction: pay.id,
          cancel_time: now.getTime(),
          state: PaymeState.CANCELLED_AFTER_PERFORM,
        };
      }

      // Already cancelled: repeat the stored answer.
      return { transaction: pay.id, cancel_time: ms(pay.cancelledAt), state: paymeStateOf(pay) };
    });
  }

  async checkTransaction(params: unknown): Promise<unknown> {
    const p = parseParams(txIdParams, params);
    const pay = await this.findTx(this.prisma, p.id);
    if (!pay) throw new PaymeRpcError(PaymeErrorCode.TRANSACTION_NOT_FOUND);
    return {
      create_time: ms(pay.createdAt),
      perform_time: ms(pay.performedAt),
      cancel_time: ms(pay.cancelledAt),
      transaction: pay.id,
      state: paymeStateOf(pay),
      reason: pay.cancelReason ?? null,
    };
  }

  async getStatement(params: unknown): Promise<unknown> {
    const p = parseParams(statementParams, params);
    const payments = await this.prisma.payment.findMany({
      where: {
        provider: PaymentProvider.PAYME,
        providerCreatedAt: { gte: BigInt(p.from), lte: BigInt(p.to) },
      },
      orderBy: { providerCreatedAt: 'asc' },
    });
    const orderIds = [...new Set(payments.map((x) => x.orderId))];
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, number: true },
        })
      : [];
    const numberOf = new Map(orders.map((o) => [o.id, o.number]));
    return {
      transactions: payments.map((pay) => ({
        id: pay.providerTransactionId,
        time: Number(pay.providerCreatedAt ?? 0n),
        amount: pay.amount,
        account: { [PAYME_ACCOUNT_FIELD]: String(numberOf.get(pay.orderId) ?? '') },
        create_time: ms(pay.createdAt),
        perform_time: ms(pay.performedAt),
        cancel_time: ms(pay.cancelledAt),
        transaction: pay.id,
        state: paymeStateOf(pay),
        reason: pay.cancelReason ?? null,
      })),
    };
  }

  // ── helpers ──

  /**
   * Runs `fn` in one DB transaction. A PaymeRpcError still COMMITS what was written before it
   * (e.g. a timed-out transaction is cancelled, then -31008 is returned); other errors roll back.
   */
  private async inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const out = await this.prisma.$transaction(async (tx) => {
      try {
        return { ok: await fn(tx) } as const;
      } catch (err) {
        if (err instanceof PaymeRpcError) return { err } as const;
        throw err;
      }
    });
    if ('err' in out) throw out.err;
    return out.ok;
  }

  private findTx(db: Pick<Tx, 'payment'>, providerTransactionId: string): Promise<Payment | null> {
    return db.payment.findUnique({
      where: {
        provider_providerTransactionId: { provider: PaymentProvider.PAYME, providerTransactionId },
      },
    });
  }

  private async findOrder(db: Pick<Tx, 'order'>, account: unknown): Promise<Order> {
    const number = parseOrderNumber(isRecord(account) ? account[PAYME_ACCOUNT_FIELD] : undefined);
    if (number === null)
      throw new PaymeRpcError(PaymeErrorCode.ORDER_NOT_FOUND, PAYME_ACCOUNT_FIELD);
    const order = await db.order.findUnique({ where: { number } });
    if (!order) throw new PaymeRpcError(PaymeErrorCode.ORDER_NOT_FOUND, PAYME_ACCOUNT_FIELD);
    return order;
  }

  /** Amount must equal the order amount from our DB; the order must still be open. */
  private async assertPayable(
    db: Pick<Tx, 'enrollment'>,
    order: Order,
    amount: unknown,
    now: Date,
  ): Promise<number> {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount !== order.amount) {
      throw new PaymeRpcError(PaymeErrorCode.WRONG_AMOUNT);
    }
    if (order.status !== PaymentStatus.PENDING || (order.expiresAt && order.expiresAt <= now)) {
      throw new PaymeRpcError(PaymeErrorCode.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);
    }
    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      select: { revokedAt: true },
    });
    if (enrollment && !enrollment.revokedAt) {
      // Already has access (e.g. paid another order): don't take the money twice.
      throw new PaymeRpcError(PaymeErrorCode.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);
    }
    return amount;
  }

  private isTimedOut(pay: Payment, now: Date): boolean {
    return now.getTime() - pay.createdAt.getTime() > PAYME_TX_TIMEOUT_MS;
  }

  private async cancelAsTimedOut(tx: Tx, pay: Payment, now: Date): Promise<void> {
    await tx.payment.update({
      where: { id: pay.id },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: now,
        cancelReason: PAYME_REASON_TIMEOUT,
      },
    });
  }

  /** Fiscal receipt detail (only when IKPU + package code are configured). */
  private async receiptDetail(order: Order): Promise<unknown> {
    const { PAYME_IKPU_CODE: code, PAYME_PACKAGE_CODE: packageCode } = this.config.env;
    if (!code || !packageCode) return undefined;
    const course = await this.prisma.course.findUnique({
      where: { id: order.courseId },
      select: { title: true },
    });
    return {
      receipt_type: 0,
      items: [
        {
          title: course?.title ?? `Order ${order.number}`,
          price: order.amount,
          count: 1,
          code,
          package_code: packageCode,
          vat_percent: 0,
        },
      ],
    };
  }
}
