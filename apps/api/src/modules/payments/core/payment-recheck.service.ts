import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@onlinedars/shared';
import type { Payment } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PAYME_REASON_TIMEOUT, PAYME_TX_TIMEOUT_MS } from '../payme/payme.errors';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { lockOrder } from './payments-db';

/** What a provider says about a transaction we still consider PENDING. */
export type ProviderPaymentState = 'PAID' | 'CANCELLED' | 'PENDING' | 'UNKNOWN';

/**
 * Asks a provider for a transaction's real status. The default answers UNKNOWN for every
 * provider: we never call provider APIs without credentials. A real implementation (e.g. the
 * Click Merchant API `payment/status`) can be bound in PaymentsCoreModule later.
 */
export abstract class PaymentStatusChecker {
  abstract check(payment: Payment): Promise<ProviderPaymentState>;
}

@Injectable()
export class NoopPaymentStatusChecker extends PaymentStatusChecker {
  async check(): Promise<ProviderPaymentState> {
    return 'UNKNOWN';
  }
}

/** Only payments older than this are looked at. */
export const RECHECK_MIN_AGE_MS = 15 * 60 * 1000;
/** A Click Prepare without Complete is abandoned after this long. */
export const CLICK_PREPARE_TIMEOUT_MS = 60 * 60 * 1000;
const BATCH = 200;

export interface RecheckSummary {
  checked: number;
  paid: number;
  cancelled: number;
  expiredOrders: number;
}

/**
 * Re-checks stuck PENDING payments and expires abandoned orders. Run by the worker's BullMQ
 * `payment-recheck` job (or inline when Redis is not configured). Safe to run concurrently:
 * every change is a conditional update under the order row lock.
 */
@Injectable()
export class PaymentRecheckService {
  private readonly logger = new Logger(PaymentRecheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checker: PaymentStatusChecker,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(now: Date = new Date()): Promise<RecheckSummary> {
    const summary: RecheckSummary = { checked: 0, paid: 0, cancelled: 0, expiredOrders: 0 };

    const stale = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: new Date(now.getTime() - RECHECK_MIN_AGE_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    for (const pay of stale) {
      summary.checked++;
      try {
        const outcome = await this.recheckPayment(pay, now);
        if (outcome === 'PAID') summary.paid++;
        if (outcome === 'CANCELLED') summary.cancelled++;
      } catch (err) {
        this.logger.warn(`recheck of payment ${pay.id} failed: ${String(err)}`);
      }
    }

    summary.expiredOrders = await this.expireOrders(now);
    if (summary.checked || summary.expiredOrders) {
      this.logger.log(`payment recheck: ${JSON.stringify(summary)}`);
    }
    return summary;
  }

  private async recheckPayment(pay: Payment, now: Date): Promise<ProviderPaymentState> {
    let state = await this.checker.check(pay);
    if (state === 'UNKNOWN' || state === 'PENDING') {
      const age = now.getTime() - pay.createdAt.getTime();
      const timeout =
        pay.provider === PaymentProvider.PAYME ? PAYME_TX_TIMEOUT_MS : CLICK_PREPARE_TIMEOUT_MS;
      if (age <= timeout) return state;
      state = 'CANCELLED';
    }

    let notificationId: string | undefined;
    const changed = await this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, pay.orderId);
      const fresh = await tx.payment.findUniqueOrThrow({ where: { id: pay.id } });
      if (fresh.status !== PaymentStatus.PENDING) return false;
      if (state === 'PAID') {
        const order = await tx.order.findUniqueOrThrow({ where: { id: pay.orderId } });
        if (order.status !== PaymentStatus.PENDING) return false;
        await tx.payment.update({
          where: { id: pay.id },
          data: { status: PaymentStatus.PAID, performedAt: now },
        });
        const res = await this.fulfillment.markPaid(tx, pay.orderId, {
          provider: pay.provider,
          now,
        });
        notificationId = res.notificationId;
        return true;
      }
      await tx.payment.update({
        where: { id: pay.id },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: pay.provider === PaymentProvider.PAYME ? PAYME_REASON_TIMEOUT : null,
        },
      });
      return true;
    });
    if (notificationId) void this.notifications.deliver(notificationId);
    return changed ? state : 'PENDING';
  }

  /** PENDING orders past `expiresAt` with no open provider transaction → CANCELLED. */
  private async expireOrders(now: Date): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: { status: PaymentStatus.PENDING, expiresAt: { lt: now } },
      select: { id: true },
      take: BATCH,
    });
    let count = 0;
    for (const { id } of expired) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await lockOrder(tx, id);
        const open = await tx.payment.count({
          where: { orderId: id, status: PaymentStatus.PENDING },
        });
        if (open > 0) return false;
        const res = await tx.order.updateMany({
          where: { id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.CANCELLED, cancelledAt: now },
        });
        return res.count === 1;
      });
      if (changed) count++;
    }
    return count;
  }
}
