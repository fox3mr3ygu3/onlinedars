/**
 * API e2e for payments: orders, Payme Merchant API, Click Prepare/Complete, idempotency,
 * amount mismatch, ownership, admin status change + audit log, notifications.
 * Provider requests use realistic payload fixtures (fake credentials). Never calls providers.
 * Needs a migrated Postgres at DATABASE_URL; skipped when it is not set.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import {
  clickComplete,
  clickPrepare,
  payme,
  paymeAuthHeader,
  paymeTxId,
  TEST_PAYMENT_ENV,
} from '../src/modules/payments/testing/fixtures';

// Provider config must be in place before AppModule reads the environment.
Object.assign(process.env, TEST_PAYMENT_ENV);

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `pay${Date.now()}`;
const PASSWORD = 'Parol12345!';
const PRICE = 25_000_000; // 250 000 so'm
const PRICE_SUM = '250000';

describe.skipIf(!hasDb)('payments e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const courseIds: string[] = [];
  let paidCourseId = '';
  let clickCourseId = '';
  let freeCourseId = '';

  async function register(name: string): Promise<{ token: string; id: string }> {
    const res = await http
      .post('/api/v1/auth/register')
      .send({
        fullName: `E2E ${name}`,
        email: `${name}.${RUN}@test.onlinedars.uz`,
        password: PASSWORD,
      })
      .expect(201);
    return { token: res.body.accessToken as string, id: res.body.user.id as string };
  }

  async function course(slug: string, price: number, isFree = false): Promise<string> {
    const c = await prisma.course.create({
      data: { slug: `${slug}-${RUN}`, title: `E2E ${slug}`, status: 'PUBLISHED', price, isFree },
    });
    courseIds.push(c.id);
    return c.id;
  }

  const rpc = (body: object, auth = paymeAuthHeader()) =>
    http.post('/api/v1/payments/payme').set('Authorization', auth).send(body).expect(200);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    paidCourseId = await course('payme', PRICE);
    clickCourseId = await course('click', PRICE);
    freeCourseId = await course('free', 0, true);
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: orderIds } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${RUN}@test.onlinedars.uz` } } });
    await prisma.$disconnect();
    await app?.close();
  });

  describe('Payme flow', () => {
    let student: { token: string; id: string };
    let order: { orderId: string; number: number; amount: number; redirectUrl: string };
    const txId = paymeTxId();

    it('POST /orders takes the amount from the DB and returns a Payme checkout URL', async () => {
      student = await register('payme');
      const res = await http
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ courseId: paidCourseId, provider: 'PAYME', amount: 100 })
        .expect(201);
      expect(res.body).toMatchObject({ enrolled: false, amount: PRICE, status: 'PENDING' });
      expect(res.body.redirectUrl).toMatch(/^https:\/\/checkout\.test\.paycom\.uz\//);
      order = res.body;
    });

    it('the browser redirect alone grants nothing: status stays PENDING', async () => {
      const res = await http
        .get(`/api/v1/orders/${order.orderId}`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(res.body).toMatchObject({ status: 'PENDING', enrolled: false });
    });

    it('rejects wrong Basic auth with -32504 (HTTP 200)', async () => {
      const res = await rpc(payme.checkPerform(order.number, PRICE), paymeAuthHeader('wrong'));
      expect(res.body.error.code).toBe(-32504);
    });

    it('CheckPerformTransaction: wrong amount -31001, unknown order -31050, ok → allow', async () => {
      expect((await rpc(payme.checkPerform(order.number, PRICE - 1))).body.error.code).toBe(-31001);
      expect((await rpc(payme.checkPerform(2_000_000_000, PRICE))).body.error.code).toBe(-31050);
      expect((await rpc(payme.checkPerform(order.number, PRICE))).body.result).toEqual({
        allow: true,
      });
    });

    it('CreateTransaction is idempotent per Payme id; a second id → -31099', async () => {
      const first = await rpc(payme.create(txId, order.number, PRICE));
      expect(first.body.result.state).toBe(1);
      const again = await rpc(payme.create(txId, order.number, PRICE));
      expect(again.body.result).toEqual(first.body.result);
      expect((await rpc(payme.create(paymeTxId(), order.number, PRICE))).body.error.code).toBe(
        -31099,
      );
    });

    it('PerformTransaction grants access once; a repeated Perform returns the same result', async () => {
      const first = await rpc(payme.perform(txId));
      expect(first.body.result.state).toBe(2);
      const again = await rpc(payme.perform(txId));
      expect(again.body.result).toEqual(first.body.result);

      expect(
        await prisma.enrollment.count({ where: { userId: student.id, courseId: paidCourseId } }),
      ).toBe(1);
      expect(
        await prisma.notification.count({ where: { userId: student.id, type: 'PAYMENT_SUCCESS' } }),
      ).toBe(1);
      const status = await http
        .get(`/api/v1/orders/${order.orderId}`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(status.body).toMatchObject({ status: 'PAID', enrolled: true, provider: 'PAYME' });
    });

    it('CheckTransaction and GetStatement report the performed transaction', async () => {
      const check = await rpc(payme.check(txId));
      expect(check.body.result).toMatchObject({ state: 2, cancel_time: 0, reason: null });
      const st = await rpc(payme.statement(Date.now() - 3_600_000, Date.now() + 1000));
      expect(st.body.result.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: txId, account: { order_id: String(order.number) } }),
        ]),
      );
    });

    it('student sees own order history and the success notification; can mark it read', async () => {
      const list = await http
        .get('/api/v1/me/orders')
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(list.body.items).toEqual([
        expect.objectContaining({ orderId: order.orderId, status: 'PAID' }),
      ]);
      const notes = await http
        .get('/api/v1/me/notifications')
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(notes.body.unreadCount).toBe(1);
      const id = notes.body.items[0].id as string;
      await http
        .post(`/api/v1/me/notifications/${id}/read`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
    });

    it('ownership: another student cannot read the order or the notification', async () => {
      const other = await register('other');
      await http
        .get(`/api/v1/orders/${order.orderId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
      const mine = await http
        .get('/api/v1/me/orders')
        .set('Authorization', `Bearer ${other.token}`)
        .expect(200);
      expect(mine.body.total).toBe(0);
      const note = await prisma.notification.findFirstOrThrow({ where: { userId: student.id } });
      await http
        .post(`/api/v1/me/notifications/${note.id}/read`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(404);
    });

    it('CancelTransaction after perform refunds and revokes access (REFUND_POLICY default revoke)', async () => {
      const res = await rpc(payme.cancel(txId, 5));
      expect(res.body.result.state).toBe(-2);
      const order2 = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(order2.status).toBe('REFUNDED');
      const enrollment = await prisma.enrollment.findFirstOrThrow({
        where: { userId: student.id, courseId: paidCourseId },
      });
      expect(enrollment.revokedAt).not.toBeNull();
      expect(
        await prisma.auditLog.count({
          where: { entityId: order.orderId, action: 'payment.refund' },
        }),
      ).toBe(1);
    });
  });

  describe('Click flow', () => {
    let student: { token: string; id: string };
    let order: { orderId: string; number: number };

    it('Prepare → Complete with form-urlencoded bodies grants access; duplicates are safe', async () => {
      student = await register('click');
      const created = await http
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ courseId: clickCourseId, provider: 'CLICK' })
        .expect(201);
      order = created.body;
      expect(created.body.redirectUrl).toContain('https://my.click.uz/services/pay?service_id=');

      const prep = clickPrepare({ orderNumber: order.number, amount: PRICE_SUM });
      const p1 = await http
        .post('/api/v1/payments/click/prepare')
        .type('form')
        .send(prep)
        .expect(200);
      expect(p1.body).toMatchObject({ error: 0, merchant_prepare_id: order.number });
      const p2 = await http
        .post('/api/v1/payments/click/prepare')
        .type('form')
        .send(prep)
        .expect(200);
      expect(p2.body).toEqual(p1.body);

      const done = clickComplete({
        orderNumber: order.number,
        amount: PRICE_SUM,
        clickTransId: prep.click_trans_id,
        merchantPrepareId: order.number,
      });
      const c1 = await http
        .post('/api/v1/payments/click/complete')
        .type('form')
        .send(done)
        .expect(200);
      expect(c1.body).toMatchObject({ error: 0, merchant_confirm_id: order.number });
      const c2 = await http
        .post('/api/v1/payments/click/complete')
        .type('form')
        .send(done)
        .expect(200);
      expect(c2.body.error).toBe(-4);
      expect(
        await prisma.enrollment.count({ where: { userId: student.id, courseId: clickCourseId } }),
      ).toBe(1);
    });

    it('bad signature → -1, amount mismatch → -2', async () => {
      const other = await register('click2');
      const created = await http
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ courseId: clickCourseId, provider: 'CLICK' })
        .expect(201);
      const bad = {
        ...clickPrepare({ orderNumber: created.body.number, amount: PRICE_SUM }),
        sign_string: '0'.repeat(32),
      };
      expect(
        (await http.post('/api/v1/payments/click/prepare').type('form').send(bad)).body.error,
      ).toBe(-1);
      const wrong = clickPrepare({ orderNumber: created.body.number, amount: '1000' });
      expect(
        (await http.post('/api/v1/payments/click/prepare').type('form').send(wrong)).body.error,
      ).toBe(-2);
    });
  });

  describe('free course and admin', () => {
    it('free course → enrolled directly, no order', async () => {
      const s = await register('free');
      const res = await http
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${s.token}`)
        .send({ courseId: freeCourseId, provider: 'PAYME' })
        .expect(201);
      expect(res.body).toEqual({ enrolled: true, courseId: freeCourseId });
      expect(await prisma.order.count({ where: { userId: s.id } })).toBe(0);
    });

    it('admin endpoints: student and content manager get 403', async () => {
      const s = await register('nonadmin');
      await http
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${s.token}`)
        .expect(403);
      await prisma.user.update({ where: { id: s.id }, data: { role: 'CONTENT_MANAGER' } });
      await http
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${s.token}`)
        .expect(403);
      await http
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${s.token}`)
        .expect(403);
    });

    it('ADMIN lists with filters and changes a status with a reason → audit log (before/after)', async () => {
      const admin = await register('admin');
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      const buyer = await register('manual');
      const created = await http
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ courseId: paidCourseId, provider: 'PAYME' })
        .expect(201);

      const list = await http
        .get(
          `/api/v1/admin/payments?courseId=${paidCourseId}&status=PENDING&search=${created.body.number}`,
        )
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(list.body.items).toEqual([expect.objectContaining({ orderId: created.body.orderId })]);

      await http
        .patch(`/api/v1/admin/payments/${created.body.orderId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PAID' })
        .expect(400);
      const changed = await http
        .patch(`/api/v1/admin/payments/${created.body.orderId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PAID', reason: 'Paid by bank transfer' })
        .expect(200);
      expect(changed.body).toMatchObject({ status: 'PAID', enrolled: true });
      const bad = await http
        .patch(`/api/v1/admin/payments/${created.body.orderId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'PENDING', reason: 'try to reopen' })
        .expect(409);
      expect(bad.body.code).toBe('INVALID_STATUS_TRANSITION');

      const audit = await http
        .get(`/api/v1/admin/audit-logs?entityType=Order&entityId=${created.body.orderId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(audit.body.items).toEqual([
        expect.objectContaining({
          action: 'payment.status.change',
          reason: 'Paid by bank transfer',
          before: expect.objectContaining({ status: 'PENDING' }),
          after: expect.objectContaining({ status: 'PAID' }),
          actor: expect.objectContaining({ id: admin.id }),
        }),
      ]);
    });
  });
});
