import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminPaymentStatusChange,
  type AdminPaymentView,
  type AuthPrincipal,
  ErrorCode,
  type Paginated,
  type PaymentListQuery,
  PaymentStatus,
  type RefundPolicy,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OrderFulfillmentService } from '../core/order-fulfillment.service';
import { getRefundPolicy, lockOrder, type Tx } from '../core/payments-db';
import { orderViewInclude, toOrderView } from '../orders/orders.service';

/**
 * Manual status changes an ADMIN may make (everything else is driven by provider callbacks).
 * → PAID grants access (e.g. bank transfer confirmed by phone); PAID → REFUNDED applies the
 * REFUND_POLICY; PENDING → CANCELLED/FAILED closes an abandoned order.
 */
export const ADMIN_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: [PaymentStatus.PAID, PaymentStatus.CANCELLED, PaymentStatus.FAILED],
  CANCELLED: [PaymentStatus.PAID],
  FAILED: [PaymentStatus.PAID],
  PAID: [PaymentStatus.REFUNDED],
  REFUNDED: [],
};

export function isAllowedAdminTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ADMIN_TRANSITIONS[from].includes(to);
}

/** Builds the Prisma filter for GET /admin/payments (pure, unit-tested). */
export function buildAdminPaymentWhere(q: PaymentListQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (q.status) and.push({ status: q.status });
  if (q.provider) and.push({ provider: q.provider });
  if (q.courseId) and.push({ courseId: q.courseId });
  if (q.userId) and.push({ userId: q.userId });
  if (q.minAmount !== undefined || q.maxAmount !== undefined) {
    and.push({
      amount: {
        ...(q.minAmount !== undefined ? { gte: q.minAmount } : {}),
        ...(q.maxAmount !== undefined ? { lte: q.maxAmount } : {}),
      },
    });
  }
  if (q.from || q.to) {
    and.push({
      createdAt: {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      },
    });
  }
  if (q.search) {
    const s = q.search.replace(/^#/, '');
    const or: Prisma.OrderWhereInput[] = [
      { id: s },
      { user: { fullName: { contains: s, mode: 'insensitive' } } },
      { user: { email: { contains: s.toLowerCase() } } },
      { user: { phone: { contains: s } } },
    ];
    if (/^\d{1,9}$/.test(s)) or.push({ number: Number(s) });
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

const adminInclude = {
  ...orderViewInclude,
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

type AdminOrder = Prisma.OrderGetPayload<{ include: typeof adminInclude }>;

function toAdminView(o: AdminOrder): AdminPaymentView {
  return {
    ...toOrderView(o),
    student: o.user,
    transactions: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerTransactionId: p.providerTransactionId,
      amount: p.amount,
      status: p.status,
      performedAt: p.performedAt?.toISOString() ?? null,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      cancelReason: p.cancelReason,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: PaymentListQuery): Promise<Paginated<AdminPaymentView>> {
    const where = buildAdminPaymentWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: rows.map(toAdminView), total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * ADMIN manual status change of an order (`id` = Order id). Restricted to ADMIN_TRANSITIONS,
   * reason required; writes an AuditLog row with before/after in the same DB transaction.
   */
  async changeStatus(
    actor: AuthPrincipal,
    orderId: string,
    input: AdminPaymentStatusChange,
    meta: RequestMeta = {},
    now: Date = new Date(),
  ): Promise<AdminPaymentView> {
    let notificationId: string | undefined;
    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!exists) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND);
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (!isAllowedAdminTransition(order.status, input.status)) {
        throw new AppException(
          ErrorCode.INVALID_STATUS_TRANSITION,
          HttpStatus.CONFLICT,
          `${order.status} → ${input.status} is not allowed`,
        );
      }
      const before = await this.snapshot(tx, orderId);

      let refundPolicy: RefundPolicy | undefined;
      if (input.status === PaymentStatus.PAID) {
        const res = await this.fulfillment.markPaid(tx, orderId, { from: [order.status], now });
        notificationId = res.notificationId;
      } else if (input.status === PaymentStatus.REFUNDED) {
        refundPolicy = await getRefundPolicy(tx);
        await this.fulfillment.markRefunded(tx, orderId, refundPolicy, now);
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { status: input.status, cancelledAt: now },
        });
      }

      const after = await this.snapshot(tx, orderId);
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'payment.status.change',
          entityType: 'Order',
          entityId: orderId,
          before,
          after: refundPolicy ? { ...after, refundPolicy } : after,
          reason: input.reason,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx,
      );
    });
    if (notificationId) void this.notifications.deliver(notificationId);
    const view = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: adminInclude,
    });
    return toAdminView(view);
  }

  private async snapshot(tx: Tx, orderId: string) {
    const o = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, paidAt: true, cancelledAt: true, userId: true, courseId: true },
    });
    const enrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: o.userId, courseId: o.courseId } },
      select: { revokedAt: true },
    });
    return {
      status: o.status,
      paidAt: o.paidAt?.toISOString() ?? null,
      cancelledAt: o.cancelledAt?.toISOString() ?? null,
      enrolled: Boolean(enrollment && !enrollment.revokedAt),
    };
  }
}
