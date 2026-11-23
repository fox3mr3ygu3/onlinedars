import type { AuthPrincipal } from '@onlinedars/shared';
import { AppConfig } from '../../../config/app-config';
import { parseEnv } from '../../../config/env';
import type { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NoopEmailSender, NoopNotificationSmsSender } from '../../notifications/channels';
import { NotificationsService } from '../../notifications/notifications.service';
import { AdminPaymentsService } from '../admin/admin-payments.service';
import { ClickService } from '../click/click.service';
import { CheckoutUrlService } from '../core/checkout-url';
import { OrderFulfillmentService } from '../core/order-fulfillment.service';
import {
  NoopPaymentStatusChecker,
  PaymentRecheckService,
  type PaymentStatusChecker,
} from '../core/payment-recheck.service';
import { ORDER_TTL_MS } from '../core/payments-db';
import { OrdersService } from '../orders/orders.service';
import { PaymeService } from '../payme/payme.service';
import { createPaymentsFakeDb } from './payments-fake-db';
import { TEST_PAYMENT_ENV } from './fixtures';

/** Wires the real payment services onto the in-memory fake DB. */
export function createPaymentsKit(
  env: Record<string, string | undefined> = {},
  checker: PaymentStatusChecker = new NoopPaymentStatusChecker(),
) {
  const db = createPaymentsFakeDb();
  const config = new AppConfig(
    parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://unit:test@localhost:5432/unit',
      JWT_ACCESS_SECRET: 'unit-access-secret-0123456789-abcdefghijkl',
      JWT_REFRESH_SECRET: 'unit-refresh-secret-0123456789-abcdefghijk',
      WEB_URL: 'https://onlinedars.test',
      ...TEST_PAYMENT_ENV,
      ...env,
    }),
  );
  const prisma = db as unknown as PrismaService;
  const notifications = new NotificationsService(
    prisma,
    new NoopEmailSender(),
    new NoopNotificationSmsSender(),
  );
  const audit = new AuditService(prisma);
  const fulfillment = new OrderFulfillmentService(notifications);
  const kit = {
    db,
    config,
    notifications,
    audit,
    fulfillment,
    orders: new OrdersService(prisma, new CheckoutUrlService(config)),
    payme: new PaymeService(prisma, config, fulfillment, notifications, audit),
    click: new ClickService(prisma, config, fulfillment, notifications),
    admin: new AdminPaymentsService(prisma, fulfillment, audit, notifications),
    recheck: new PaymentRecheckService(prisma, checker, fulfillment, notifications),

    async student(name = 'Talaba'): Promise<AuthPrincipal> {
      const u = (await db.user.create({
        data: { fullName: name, email: `${name.toLowerCase()}.${db.user.rows.length}@test.uz` },
      })) as { id: string };
      return { id: u.id, role: 'STUDENT', sessionId: 's' };
    },

    async adminUser(): Promise<AuthPrincipal> {
      const u = (await db.user.create({ data: { fullName: 'Admin', role: 'ADMIN' } })) as {
        id: string;
      };
      return { id: u.id, role: 'ADMIN', sessionId: 's' };
    },

    async course(over: Record<string, unknown> = {}) {
      return (await db.course.create({
        data: { title: 'Python asoslari', slug: 'python-asoslari', price: 15_000_000, ...over },
      })) as { id: string; price: number; title: string };
    },

    /** A PENDING order for `userId` (amount = course price), as OrdersService would create it. */
    async order(
      userId: string,
      course: { id: string; price: number },
      over: Record<string, unknown> = {},
    ) {
      return (await db.order.create({
        data: {
          userId,
          courseId: course.id,
          amount: course.price,
          expiresAt: new Date(Date.now() + ORDER_TTL_MS),
          ...over,
        },
      })) as { id: string; number: number; amount: number; userId: string; courseId: string };
    },

    orderRow: (id: string) => db.order.rows.find((r) => r.id === id) as Record<string, unknown>,
    enrollmentsOf: (userId: string) => db.enrollment.rows.filter((r) => r.userId === userId),
    notificationsOf: (userId: string) => db.notification.rows.filter((r) => r.userId === userId),
  };
  return kit;
}

export type PaymentsKit = ReturnType<typeof createPaymentsKit>;
