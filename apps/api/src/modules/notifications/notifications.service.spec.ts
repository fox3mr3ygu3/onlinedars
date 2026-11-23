import { ErrorCode } from '@onlinedars/shared';
import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { PrismaService } from '../../prisma/prisma.service';
import { createPaymentsFakeDb } from '../payments/testing/payments-fake-db';
import { EmailSender, NotificationSmsSender } from './channels';
import { NotificationsService, paymentSuccessNotification } from './notifications.service';

function setup() {
  const db = createPaymentsFakeDb();
  const email = { send: vi.fn(async () => undefined) } as unknown as EmailSender;
  const sms = { send: vi.fn(async () => undefined) } as unknown as NotificationSmsSender;
  const service = new NotificationsService(db as unknown as PrismaService, email, sms);
  return { db, email, sms, service };
}

const note = (userId: string) =>
  paymentSuccessNotification({
    userId,
    courseId: 'c1',
    courseTitle: 'Python',
    courseSlug: 'python',
    orderId: 'o1',
    orderNumber: 1001,
  });

describe('NotificationsService', () => {
  it('lists only the own notifications, newest first, with unread count', async () => {
    const { service } = setup();
    await service.create(note('me'));
    await new Promise((r) => setTimeout(r, 2));
    await service.create({ ...note('me'), title: 'second' });
    await service.create(note('someone-else'));
    const page = await service.listOwn('me', { page: 1, pageSize: 20, unreadOnly: false });
    expect(page.total).toBe(2);
    expect(page.unreadCount).toBe(2);
    expect(page.items[0]?.title).toBe('second');
    expect(page.items[0]?.data).toMatchObject({ courseId: 'c1', orderNumber: 1001 });
  });

  it("marks read; another user's notification → 404 (no leak)", async () => {
    const { service } = setup();
    const mine = await service.create(note('me'));
    const theirs = await service.create(note('other'));
    const read = await service.markRead('me', mine.id);
    expect(read.readAt).not.toBeNull();
    await expect(service.markRead('me', theirs.id)).rejects.toSatisfy(
      (e: unknown) => e instanceof AppException && e.code === ErrorCode.NOT_FOUND,
    );
    expect((await service.listOwn('me', { page: 1, pageSize: 20, unreadOnly: true })).total).toBe(
      0,
    );
  });

  it('markAllRead only touches the own unread notifications', async () => {
    const { service } = setup();
    await service.create(note('me'));
    await service.create(note('me'));
    await service.create(note('other'));
    expect(await service.markAllRead('me')).toEqual({ updated: 2 });
    expect(
      (await service.listOwn('other', { page: 1, pageSize: 20, unreadOnly: true })).total,
    ).toBe(1);
  });

  it('deliver() sends through email and SMS channels and never throws', async () => {
    const { db, service, email, sms } = setup();
    const u = (await db.user.create({
      data: { fullName: 'A', email: 'a@test.uz', phone: '+998901234567' },
    })) as { id: string };
    const n = await service.create(note(u.id));
    await service.deliver(n.id);
    expect(email.send).toHaveBeenCalledWith('a@test.uz', n.title, n.body);
    expect(sms.send).toHaveBeenCalledOnce();
    (email.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.deliver(n.id)).resolves.toBeUndefined();
  });
});
