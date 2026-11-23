import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@onlinedars/shared';
import type { Order, Payment, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OrderFulfillmentService } from '../core/order-fulfillment.service';
import { lockOrder, parseOrderNumber, type Tx } from '../core/payments-db';
import {
  CLICK_ERROR_NOTES,
  ClickAction,
  clickAmountToTiyin,
  ClickError,
  ClickErrorCode,
  verifyClickSign,
} from './click.errors';

const str = z.union([z.string(), z.number()]).transform((v) => String(v));

const prepareSchema = z.object({
  click_trans_id: str,
  service_id: str,
  click_paydoc_id: str.optional(),
  merchant_trans_id: str,
  amount: str,
  action: str,
  error: str.optional(),
  error_note: z.string().optional(),
  sign_time: str,
  sign_string: z.string().min(1),
});
const completeSchema = prepareSchema.extend({ merchant_prepare_id: str });

type PrepareParams = z.infer<typeof prepareSchema>;
type CompleteParams = z.infer<typeof completeSchema>;

export interface ClickPrepareResponse {
  click_trans_id: string | null;
  merchant_trans_id: string | null;
  merchant_prepare_id: number | null;
  error: ClickErrorCode;
  error_note: string;
}

export interface ClickCompleteResponse {
  click_trans_id: string | null;
  merchant_trans_id: string | null;
  merchant_confirm_id: number | null;
  error: ClickErrorCode;
  error_note: string;
}

/**
 * Click SHOP-API: Prepare (action=0) and Complete (action=1), form-urlencoded POSTs from Click,
 * authenticated by the MD5 `sign_string`. `merchant_trans_id` = our Order.number, and our
 * `merchant_prepare_id` / `merchant_confirm_id` = Order.number as well. Amounts arrive in so'm.
 * Payment is unique on (CLICK, click_trans_id); enrollment happens once, in Complete.
 */
@Injectable()
export class ClickService {
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly notifications: NotificationsService,
  ) {}

  async prepare(body: unknown, now: Date = new Date()): Promise<ClickPrepareResponse> {
    const echo = this.echo(body);
    try {
      const p = this.parseAndVerify(prepareSchema, body, ClickAction.PREPARE);
      const prepareId = await this.inTx(async (tx) => {
        const order = await this.lockedOrder(tx, p.merchant_trans_id);
        this.assertAmount(p.amount, order.amount);

        const existing = await this.findTx(tx, p.click_trans_id);
        if (existing) {
          if (existing.orderId !== order.id)
            throw new ClickError(ClickErrorCode.TRANSACTION_NOT_FOUND);
          if (existing.status === PaymentStatus.PAID)
            throw new ClickError(ClickErrorCode.ALREADY_PAID);
          if (existing.status !== PaymentStatus.PENDING) {
            throw new ClickError(ClickErrorCode.TRANSACTION_CANCELLED);
          }
          return order.number; // repeated Prepare → same answer
        }

        await this.assertOrderOpen(tx, order, now);
        const otherProvider = await tx.payment.count({
          where: {
            orderId: order.id,
            status: PaymentStatus.PENDING,
            provider: { not: PaymentProvider.CLICK },
          },
        });
        if (otherProvider > 0) throw new ClickError(ClickErrorCode.TRANSACTION_CANCELLED);

        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: PaymentProvider.CLICK,
            providerTransactionId: p.click_trans_id,
            amount: order.amount,
            currency: order.currency,
            status: PaymentStatus.PENDING,
            raw: this.rawOf('prepare', p),
            createdAt: now,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { provider: PaymentProvider.CLICK },
        });
        return order.number;
      });
      return { ...echo, merchant_prepare_id: prepareId, ...this.ok() };
    } catch (err) {
      return { ...echo, merchant_prepare_id: null, ...this.fail(err) };
    }
  }

  async complete(body: unknown, now: Date = new Date()): Promise<ClickCompleteResponse> {
    const echo = this.echo(body);
    let notificationId: string | undefined;
    try {
      const p = this.parseAndVerify(completeSchema, body, ClickAction.COMPLETE);
      const confirmId = await this.inTx(async (tx) => {
        const order = await this.lockedOrder(tx, p.merchant_trans_id);
        const pay = await this.findTx(tx, p.click_trans_id);
        if (!pay || pay.orderId !== order.id || p.merchant_prepare_id !== String(order.number)) {
          throw new ClickError(ClickErrorCode.TRANSACTION_NOT_FOUND);
        }
        this.assertAmount(p.amount, pay.amount);
        if (pay.status === PaymentStatus.PAID) throw new ClickError(ClickErrorCode.ALREADY_PAID);
        if (pay.status !== PaymentStatus.PENDING) {
          throw new ClickError(ClickErrorCode.TRANSACTION_CANCELLED);
        }

        const clickError = Number(p.error ?? '0');
        if (clickError < 0) {
          // Click reports the payment failed on its side: cancel our transaction.
          await this.cancelPayment(tx, pay, p, now, clickError);
          throw new ClickError(ClickErrorCode.TRANSACTION_CANCELLED);
        }
        if (order.status !== PaymentStatus.PENDING) {
          await this.cancelPayment(tx, pay, p, now, ClickErrorCode.TRANSACTION_CANCELLED);
          throw new ClickError(
            order.status === PaymentStatus.PAID
              ? ClickErrorCode.ALREADY_PAID
              : ClickErrorCode.TRANSACTION_CANCELLED,
          );
        }

        await tx.payment.update({
          where: { id: pay.id },
          data: { status: PaymentStatus.PAID, performedAt: now, raw: this.rawOf('complete', p) },
        });
        const paid = await this.fulfillment.markPaid(tx, order.id, {
          provider: PaymentProvider.CLICK,
          now,
        });
        notificationId = paid.notificationId;
        return order.number;
      });
      if (notificationId) void this.notifications.deliver(notificationId);
      return { ...echo, merchant_confirm_id: confirmId, ...this.ok() };
    } catch (err) {
      return { ...echo, merchant_confirm_id: null, ...this.fail(err) };
    }
  }

  // ── helpers ──

  private parseAndVerify<S extends typeof prepareSchema | typeof completeSchema>(
    schema: S,
    body: unknown,
    action: string,
  ): z.infer<S> {
    const r = schema.safeParse(body);
    if (!r.success) throw new ClickError(ClickErrorCode.BAD_REQUEST);
    const p = r.data as PrepareParams & Partial<CompleteParams>;
    if (!verifyClickSign(p, this.config.env.CLICK_SECRET_KEY)) {
      throw new ClickError(ClickErrorCode.SIGN_CHECK_FAILED);
    }
    if (p.action !== action) throw new ClickError(ClickErrorCode.ACTION_NOT_FOUND);
    if (p.service_id !== this.config.env.CLICK_SERVICE_ID) {
      throw new ClickError(ClickErrorCode.BAD_REQUEST);
    }
    return r.data as z.infer<S>;
  }

  /** Errors that are ClickError commit what was written before them; others roll back. */
  private async inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const out = await this.prisma.$transaction(async (tx) => {
      try {
        return { ok: await fn(tx) } as const;
      } catch (err) {
        if (err instanceof ClickError) return { err } as const;
        throw err;
      }
    });
    if ('err' in out) throw out.err;
    return out.ok;
  }

  private async lockedOrder(tx: Tx, merchantTransId: string): Promise<Order> {
    const number = parseOrderNumber(merchantTransId);
    if (number === null) throw new ClickError(ClickErrorCode.ORDER_NOT_FOUND);
    const found = await tx.order.findUnique({ where: { number }, select: { id: true } });
    if (!found) throw new ClickError(ClickErrorCode.ORDER_NOT_FOUND);
    await lockOrder(tx, found.id);
    return tx.order.findUniqueOrThrow({ where: { id: found.id } });
  }

  private assertAmount(amount: string, expectedTiyin: number): void {
    if (clickAmountToTiyin(amount) !== expectedTiyin) {
      throw new ClickError(ClickErrorCode.INCORRECT_AMOUNT);
    }
  }

  private async assertOrderOpen(tx: Tx, order: Order, now: Date): Promise<void> {
    if (order.status === PaymentStatus.PAID) throw new ClickError(ClickErrorCode.ALREADY_PAID);
    if (order.status !== PaymentStatus.PENDING || (order.expiresAt && order.expiresAt <= now)) {
      throw new ClickError(ClickErrorCode.TRANSACTION_CANCELLED);
    }
    const enrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      select: { revokedAt: true },
    });
    if (enrollment && !enrollment.revokedAt) throw new ClickError(ClickErrorCode.ALREADY_PAID);
  }

  private findTx(tx: Tx, clickTransId: string): Promise<Payment | null> {
    return tx.payment.findUnique({
      where: {
        provider_providerTransactionId: {
          provider: PaymentProvider.CLICK,
          providerTransactionId: clickTransId,
        },
      },
    });
  }

  private async cancelPayment(
    tx: Tx,
    pay: Payment,
    p: CompleteParams,
    now: Date,
    reason: number,
  ): Promise<void> {
    await tx.payment.update({
      where: { id: pay.id },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: now,
        cancelReason: reason,
        raw: this.rawOf('complete', p),
      },
    });
  }

  /** Stored for support; the signature is dropped. */
  private rawOf(step: string, p: PrepareParams): Prisma.InputJsonValue {
    const { sign_string: _sign, ...rest } = p;
    return { step, ...rest } as Prisma.InputJsonValue;
  }

  private echo(body: unknown): { click_trans_id: string | null; merchant_trans_id: string | null } {
    const b = (body ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null);
    return { click_trans_id: s(b.click_trans_id), merchant_trans_id: s(b.merchant_trans_id) };
  }

  private ok() {
    return { error: ClickErrorCode.SUCCESS, error_note: CLICK_ERROR_NOTES[ClickErrorCode.SUCCESS] };
  }

  private fail(err: unknown): { error: ClickErrorCode; error_note: string } {
    if (err instanceof ClickError)
      return { error: err.code, error_note: CLICK_ERROR_NOTES[err.code] };
    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return {
      error: ClickErrorCode.FAILED_TO_UPDATE,
      error_note: CLICK_ERROR_NOTES[ClickErrorCode.FAILED_TO_UPDATE],
    };
  }
}
