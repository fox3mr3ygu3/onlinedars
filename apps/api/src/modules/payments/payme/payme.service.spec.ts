import { beforeEach, describe, expect, it } from 'vitest';
import { payme, paymeAuthHeader, paymeTxId } from '../testing/fixtures';
import { createPaymentsKit, type PaymentsKit } from '../testing/payments-test-kit';
import { PAYME_TX_TIMEOUT_MS, PaymeErrorCode, PaymeState } from './payme.errors';

const AUTH = paymeAuthHeader();
type Res = {
  id: unknown;
  result?: Record<string, unknown>;
  error?: { code: number; data?: string; message: Record<string, string> };
};

describe('PaymeService (Merchant API)', () => {
  let kit: PaymentsKit;
  let call: (body: unknown, now?: Date) => Promise<Res>;
  let studentId: string;
  let course: { id: string; price: number };
  let order: { id: string; number: number; amount: number };

  beforeEach(async () => {
    kit = createPaymentsKit();
    call = (body, now) => kit.payme.handle(AUTH, body, now) as Promise<Res>;
    studentId = (await kit.student()).id;
    course = await kit.course();
    order = await kit.order(studentId, course);
  });

  describe('authentication', () => {
    it.each([
      ['missing header', undefined],
      ['wrong key', paymeAuthHeader('wrong-key')],
      ['wrong login', paymeAuthHeader(undefined, 'Admin')],
      ['not Basic', 'Bearer abc'],
      ['garbage', 'Basic !!!'],
    ])('%s → -32504 and echoes the request id', async (_name, header) => {
      const body = payme.checkPerform(order.number, order.amount);
      const res = (await kit.payme.handle(header, body)) as Res;
      expect(res.error?.code).toBe(PaymeErrorCode.INSUFFICIENT_PRIVILEGE);
      expect(res.id).toBe(body.id);
      expect(res.error?.message).toHaveProperty('uz');
    });

    it('rejects every call when PAYME_KEY is not configured', async () => {
      const k = createPaymentsKit({ PAYME_KEY: '' });
      const res = (await k.payme.handle(AUTH, payme.check('x'))) as Res;
      expect(res.error?.code).toBe(PaymeErrorCode.INSUFFICIENT_PRIVILEGE);
    });
  });

  describe('JSON-RPC envelope', () => {
    it('unknown method → -32601', async () => {
      expect(
        (await call({ method: 'ChangePassword', params: { password: 'x' }, id: 1 })).error?.code,
      ).toBe(PaymeErrorCode.METHOD_NOT_FOUND);
    });
    it('missing params → -32600', async () => {
      expect((await call({ method: 'CheckTransaction', id: 1 })).error?.code).toBe(
        PaymeErrorCode.INVALID_REQUEST,
      );
      expect((await call({ method: 'CheckTransaction', params: {}, id: 1 })).error?.code).toBe(
        PaymeErrorCode.INVALID_REQUEST,
      );
    });
  });

  describe('CheckPerformTransaction', () => {
    it('allows a pending order with the exact amount', async () => {
      const res = await call(payme.checkPerform(order.number, order.amount));
      expect(res.result).toEqual({ allow: true });
    });

    it('includes fiscal receipt detail when IKPU is configured', async () => {
      const k = createPaymentsKit({
        PAYME_IKPU_CODE: '10899002001000000',
        PAYME_PACKAGE_CODE: '1501322',
      });
      const s = await k.student();
      const c = await k.course();
      const o = await k.order(s.id, c);
      const res = (await k.payme.handle(AUTH, payme.checkPerform(o.number, o.amount))) as Res;
      expect(res.result).toMatchObject({
        allow: true,
        detail: {
          receipt_type: 0,
          items: [{ code: '10899002001000000', price: o.amount, count: 1 }],
        },
      });
    });

    it('wrong amount → -31001 (client/provider amount is never trusted)', async () => {
      const res = await call(payme.checkPerform(order.number, order.amount - 100));
      expect(res.error?.code).toBe(PaymeErrorCode.WRONG_AMOUNT);
    });

    it('unknown order → -31050 with data "order_id"', async () => {
      const res = await call(payme.checkPerform(999_999, order.amount));
      expect(res.error).toMatchObject({ code: PaymeErrorCode.ORDER_NOT_FOUND, data: 'order_id' });
      expect((await call(payme.checkPerform('abc', 1))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_FOUND,
      );
    });

    it('already paid / cancelled / expired order → -31051', async () => {
      kit.orderRow(order.id).status = 'PAID';
      expect((await call(payme.checkPerform(order.number, order.amount))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_PAYABLE,
      );
      kit.orderRow(order.id).status = 'PENDING';
      kit.orderRow(order.id).expiresAt = new Date(Date.now() - 1000);
      expect((await call(payme.checkPerform(order.number, order.amount))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_PAYABLE,
      );
    });

    it('student who already has access → -31051 (no double charge)', async () => {
      await kit.db.enrollment.create({
        data: { userId: studentId, courseId: course.id, source: 'ADMIN' },
      });
      expect((await call(payme.checkPerform(order.number, order.amount))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_PAYABLE,
      );
    });
  });

  describe('CreateTransaction', () => {
    it('creates a state-1 transaction and repeats the same answer for the same id', async () => {
      const id = paymeTxId();
      const first = await call(payme.create(id, order.number, order.amount));
      expect(first.result).toMatchObject({ state: PaymeState.CREATED });
      expect(typeof first.result?.transaction).toBe('string');
      const again = await call(payme.create(id, order.number, order.amount));
      expect(again.result).toEqual(first.result);
      expect(kit.db.payment.rows).toHaveLength(1);
    });

    it('a second transaction for the same order → -31099', async () => {
      await call(payme.create(paymeTxId(), order.number, order.amount));
      const res = await call(payme.create(paymeTxId(), order.number, order.amount));
      expect(res.error).toMatchObject({ code: PaymeErrorCode.ORDER_BUSY, data: 'order_id' });
    });

    it('wrong amount → -31001, unknown order → -31050, paid order → -31051', async () => {
      expect((await call(payme.create(paymeTxId(), order.number, 1))).error?.code).toBe(
        PaymeErrorCode.WRONG_AMOUNT,
      );
      expect((await call(payme.create(paymeTxId(), 424242, order.amount))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_FOUND,
      );
      kit.orderRow(order.id).status = 'PAID';
      expect((await call(payme.create(paymeTxId(), order.number, order.amount))).error?.code).toBe(
        PaymeErrorCode.ORDER_NOT_PAYABLE,
      );
      expect(kit.db.payment.rows).toHaveLength(0);
    });

    it('a request whose Payme time is older than 12h → -31008', async () => {
      const res = await call(
        payme.create(paymeTxId(), order.number, order.amount, Date.now() - PAYME_TX_TIMEOUT_MS - 1),
      );
      expect(res.error?.code).toBe(PaymeErrorCode.CANNOT_PERFORM);
    });

    it('repeating Create after the 12h timeout cancels it (reason 4) and returns -31008', async () => {
      const id = paymeTxId();
      const t0 = new Date();
      await call(payme.create(id, order.number, order.amount, t0.getTime()), t0);
      const later = new Date(t0.getTime() + PAYME_TX_TIMEOUT_MS + 1);
      const res = await call(payme.create(id, order.number, order.amount, t0.getTime()), later);
      expect(res.error?.code).toBe(PaymeErrorCode.CANNOT_PERFORM);
      const check = await call(payme.check(id));
      expect(check.result).toMatchObject({ state: PaymeState.CANCELLED, reason: 4 });
    });
  });

  describe('PerformTransaction', () => {
    it('performs, marks the order PAID, enrolls once and notifies once — repeated Perform returns the same result', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      const first = await call(payme.perform(id));
      expect(first.result).toMatchObject({ state: PaymeState.PERFORMED });
      const second = await call(payme.perform(id));
      expect(second.result).toEqual(first.result);

      expect(kit.orderRow(order.id)).toMatchObject({ status: 'PAID', provider: 'PAYME' });
      expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
      expect(kit.enrollmentsOf(studentId)[0]).toMatchObject({
        source: 'PURCHASE',
        orderId: order.id,
        revokedAt: null,
      });
      expect(kit.notificationsOf(studentId)).toHaveLength(1);
      expect(kit.notificationsOf(studentId)[0]).toMatchObject({ type: 'PAYMENT_SUCCESS' });
    });

    it('unknown transaction → -31003', async () => {
      expect((await call(payme.perform(paymeTxId()))).error?.code).toBe(
        PaymeErrorCode.TRANSACTION_NOT_FOUND,
      );
    });

    it('cancelled transaction → -31008, no access granted', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      await call(payme.cancel(id, 3));
      expect((await call(payme.perform(id))).error?.code).toBe(PaymeErrorCode.CANNOT_PERFORM);
      expect(kit.enrollmentsOf(studentId)).toHaveLength(0);
    });

    it('timed-out transaction → cancelled with reason 4 and -31008', async () => {
      const id = paymeTxId();
      const t0 = new Date();
      await call(payme.create(id, order.number, order.amount, t0.getTime()), t0);
      const res = await call(payme.perform(id), new Date(t0.getTime() + PAYME_TX_TIMEOUT_MS + 1));
      expect(res.error?.code).toBe(PaymeErrorCode.CANNOT_PERFORM);
      expect((await call(payme.check(id))).result).toMatchObject({ state: -1, reason: 4 });
      expect(kit.orderRow(order.id).status).toBe('PENDING');
    });

    it('order closed meanwhile (e.g. admin cancelled) → -31008 without enrolling', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      kit.orderRow(order.id).status = 'CANCELLED';
      expect((await call(payme.perform(id))).error?.code).toBe(PaymeErrorCode.CANNOT_PERFORM);
      expect(kit.enrollmentsOf(studentId)).toHaveLength(0);
    });
  });

  describe('CancelTransaction', () => {
    it('before perform: state -1, order stays PENDING, repeated cancel returns the same result', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      const first = await call(payme.cancel(id, 3));
      expect(first.result).toMatchObject({ state: PaymeState.CANCELLED });
      expect((await call(payme.cancel(id, 3))).result).toEqual(first.result);
      expect(kit.orderRow(order.id).status).toBe('PENDING');
      // The student can start a new transaction for the same order afterwards.
      expect(
        (await call(payme.create(paymeTxId(), order.number, order.amount))).result,
      ).toBeDefined();
    });

    it('after perform with REFUND_POLICY revoke (default): state -2, order REFUNDED, access revoked, audit row', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      await call(payme.perform(id));
      const res = await call(payme.cancel(id, 5));
      expect(res.result).toMatchObject({ state: PaymeState.CANCELLED_AFTER_PERFORM });
      expect(kit.orderRow(order.id).status).toBe('REFUNDED');
      expect(kit.enrollmentsOf(studentId)[0]?.revokedAt).toBeInstanceOf(Date);
      expect(kit.db.auditLog.rows).toHaveLength(1);
      expect(kit.db.auditLog.rows[0]).toMatchObject({
        action: 'payment.refund',
        entityType: 'Order',
        entityId: order.id,
        actorId: null,
      });
      expect((await call(payme.check(id))).result).toMatchObject({ state: -2, reason: 5 });
      expect((await call(payme.cancel(id, 5))).result).toEqual(res.result);
    });

    it('after perform with REFUND_POLICY keep: access stays', async () => {
      await kit.db.setting.create({ data: { key: 'refundPolicy', value: 'KEEP_ACCESS' } });
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      await call(payme.perform(id));
      await call(payme.cancel(id, 5));
      expect(kit.orderRow(order.id).status).toBe('REFUNDED');
      expect(kit.enrollmentsOf(studentId)[0]?.revokedAt).toBeNull();
    });

    it('unknown transaction → -31003', async () => {
      expect((await call(payme.cancel(paymeTxId()))).error?.code).toBe(
        PaymeErrorCode.TRANSACTION_NOT_FOUND,
      );
    });
  });

  describe('CheckTransaction / GetStatement', () => {
    it('reports times and state of each phase', async () => {
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount));
      const created = await call(payme.check(id));
      expect(created.result).toMatchObject({
        state: 1,
        perform_time: 0,
        cancel_time: 0,
        reason: null,
      });
      await call(payme.perform(id));
      const performed = await call(payme.check(id));
      expect(performed.result?.state).toBe(2);
      expect(performed.result?.perform_time).toBeGreaterThan(0);
      expect((await call(payme.check(paymeTxId()))).error?.code).toBe(
        PaymeErrorCode.TRANSACTION_NOT_FOUND,
      );
    });

    it('lists transactions created in the [from, to] window with the order account', async () => {
      const t = Date.now();
      const id = paymeTxId();
      await call(payme.create(id, order.number, order.amount, t));
      const res = await call(payme.statement(t - 1000, t + 1000));
      expect(res.result?.transactions).toEqual([
        expect.objectContaining({
          id,
          time: t,
          amount: order.amount,
          account: { order_id: String(order.number) },
          state: 1,
        }),
      ]);
      const empty = await call(payme.statement(t + 5000, t + 6000));
      expect(empty.result?.transactions).toEqual([]);
    });
  });
});
