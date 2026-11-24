import { Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  type NotificationList,
  type NotificationQuery,
  NotificationType,
  type NotificationView,
} from '@onlinedars/shared';
import type { Notification, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSender, NotificationSmsSender } from './channels';

export type NotificationDb = Pick<Prisma.TransactionClient, 'notification'>;

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Server-generated Uzbek fallback texts. The web should prefer its own i18n strings keyed by
 * `type` (+ `data`), so this text is only shown if the client has no translation.
 */
export function accessGrantedNotification(input: {
  userId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}): NewNotification {
  return {
    userId: input.userId,
    type: NotificationType.ACCESS_GRANTED,
    title: 'Kursga kirish berildi',
    body: `"${input.courseTitle}" kursiga kirish ochildi.`,
    data: {
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      courseSlug: input.courseSlug,
    },
  };
}

export function accessRejectedNotification(input: {
  userId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  reason: string;
}): NewNotification {
  return {
    userId: input.userId,
    type: NotificationType.ACCESS_REJECTED,
    title: "Kursga kirish so'rovi rad etildi",
    body: `"${input.courseTitle}": ${input.reason}`,
    data: {
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      courseSlug: input.courseSlug,
      reason: input.reason,
    },
  };
}

export function toNotificationView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailSender,
    private readonly sms: NotificationSmsSender,
  ) {}

  /** Creates an in-app notification. Pass the transaction client to commit atomically. */
  async create(input: NewNotification, db: NotificationDb = this.prisma): Promise<Notification> {
    return db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * Sends the notification through the optional email/SMS channels. Call after the DB
   * transaction committed; never throws (delivery failures are logged only).
   */
  async deliver(notificationId: string): Promise<void> {
    try {
      const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
      if (!n) return;
      const user = await this.prisma.user.findUnique({
        where: { id: n.userId },
        select: { email: true, phone: true },
      });
      if (user?.email) await this.email.send(user.email, n.title, n.body);
      if (user?.phone) await this.sms.send(user.phone, `${n.title}. ${n.body}`);
    } catch (err) {
      this.logger.warn(`notification ${notificationId} delivery failed: ${String(err)}`);
    }
  }

  async listOwn(userId: string, query: NotificationQuery): Promise<NotificationList> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items: rows.map(toNotificationView),
      total,
      page: query.page,
      pageSize: query.pageSize,
      unreadCount,
    };
  }

  /** Marks one of the user's own notifications read. Someone else's id → 404 (no leak). */
  async markRead(userId: string, id: string): Promise<NotificationView> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw AppException.notFound(ErrorCode.NOT_FOUND);
    if (n.readAt) return toNotificationView(n);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return toNotificationView(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
