import { Injectable } from '@nestjs/common';
import {
  EnrollmentSource,
  type PaymentProvider,
  PaymentStatus,
  RefundPolicy,
} from '@onlinedars/shared';
import {
  NotificationsService,
  paymentSuccessNotification,
} from '../../notifications/notifications.service';
import type { Tx } from './payments-db';

export interface PaidResult {
  /** False if the order was not in an allowed status (e.g. already PAID) — nothing changed. */
  changed: boolean;
  /** In-app notification created in the transaction; deliver it after commit. */
  notificationId?: string;
}

export interface RefundResult {
  changed: boolean;
  accessRevoked: boolean;
}

/**
 * The single place where an order becomes PAID / REFUNDED. Every method must run inside the
 * caller's DB transaction so the status change, enrollment and notification commit together.
 * Status changes use a conditional `updateMany`, so a repeated callback changes nothing and
 * enrollment is granted exactly once.
 */
@Injectable()
export class OrderFulfillmentService {
  constructor(private readonly notifications: NotificationsService) {}

  async markPaid(
    tx: Tx,
    orderId: string,
    opts: { provider?: PaymentProvider | null; from?: PaymentStatus[]; now?: Date } = {},
  ): Promise<PaidResult> {
    const now = opts.now ?? new Date();
    const res = await tx.order.updateMany({
      where: { id: orderId, status: { in: opts.from ?? [PaymentStatus.PENDING] } },
      data: {
        status: PaymentStatus.PAID,
        paidAt: now,
        cancelledAt: null,
        ...(opts.provider ? { provider: opts.provider } : {}),
      },
    });
    if (res.count !== 1) return { changed: false };

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, number: true, userId: true, courseId: true },
    });
    await this.grantEnrollment(tx, order, now);

    const course = await tx.course.findUniqueOrThrow({
      where: { id: order.courseId },
      select: { title: true, slug: true },
    });
    const notification = await this.notifications.create(
      paymentSuccessNotification({
        userId: order.userId,
        courseId: order.courseId,
        courseTitle: course.title,
        courseSlug: course.slug,
        orderId: order.id,
        orderNumber: order.number,
      }),
      tx,
    );
    return { changed: true, notificationId: notification.id };
  }

  /** PAID → REFUNDED. With policy `revoke` the enrollment granted by this order is revoked. */
  async markRefunded(
    tx: Tx,
    orderId: string,
    policy: RefundPolicy,
    now: Date = new Date(),
  ): Promise<RefundResult> {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: PaymentStatus.PAID },
      data: { status: PaymentStatus.REFUNDED, cancelledAt: now },
    });
    if (res.count !== 1) return { changed: false, accessRevoked: false };
    if (policy !== RefundPolicy.REVOKE) return { changed: true, accessRevoked: false };
    const revoked = await tx.enrollment.updateMany({
      where: { orderId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { changed: true, accessRevoked: revoked.count > 0 };
  }

  /** Creates the enrollment, or re-activates a revoked one. An active enrollment is left as is. */
  private async grantEnrollment(
    tx: Tx,
    order: { id: string; userId: string; courseId: string },
    now: Date,
  ): Promise<void> {
    const existing = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      select: { id: true, revokedAt: true },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: {
          userId: order.userId,
          courseId: order.courseId,
          source: EnrollmentSource.PURCHASE,
          orderId: order.id,
          enrolledAt: now,
        },
      });
    } else if (existing.revokedAt) {
      await tx.enrollment.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          source: EnrollmentSource.PURCHASE,
          orderId: order.id,
          enrolledAt: now,
        },
      });
    }
  }
}
