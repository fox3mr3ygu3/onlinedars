import { describe, expect, it } from 'vitest';
import type { Tx } from './payments-db';
import { getRefundPolicy } from './payments-db';
import { createPaymentsKit } from '../testing/payments-test-kit';

async function setup() {
  const kit = createPaymentsKit();
  const s = await kit.student();
  const course = await kit.course();
  const order = await kit.order(s.id, course);
  const tx = kit.db as unknown as Tx;
  return { kit, tx, studentId: s.id, course, order };
}

describe('OrderFulfillmentService', () => {
  it('markPaid grants enrollment exactly once, even when called repeatedly', async () => {
    const { kit, tx, studentId, order } = await setup();
    const first = await kit.fulfillment.markPaid(tx, order.id, { provider: 'PAYME' });
    const second = await kit.fulfillment.markPaid(tx, order.id, { provider: 'PAYME' });
    expect(first.changed).toBe(true);
    expect(first.notificationId).toBeTruthy();
    expect(second).toEqual({ changed: false });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
    expect(kit.notificationsOf(studentId)).toHaveLength(1);
  });

  it('re-activates a revoked enrollment instead of creating a second one', async () => {
    const { kit, tx, studentId, course, order } = await setup();
    await kit.db.enrollment.create({
      data: { userId: studentId, courseId: course.id, source: 'FREE', revokedAt: new Date() },
    });
    await kit.fulfillment.markPaid(tx, order.id);
    expect(kit.enrollmentsOf(studentId)).toEqual([
      expect.objectContaining({ revokedAt: null, source: 'PURCHASE', orderId: order.id }),
    ]);
  });

  it('keeps an already active enrollment untouched', async () => {
    const { kit, tx, studentId, course, order } = await setup();
    await kit.db.enrollment.create({
      data: { userId: studentId, courseId: course.id, source: 'ADMIN' },
    });
    expect((await kit.fulfillment.markPaid(tx, order.id)).changed).toBe(true);
    expect(kit.enrollmentsOf(studentId)).toEqual([expect.objectContaining({ source: 'ADMIN' })]);
  });

  it('markRefunded only acts on PAID orders and follows the policy', async () => {
    const { kit, tx, studentId, order } = await setup();
    expect(await kit.fulfillment.markRefunded(tx, order.id, 'revoke')).toEqual({
      changed: false,
      accessRevoked: false,
    });
    await kit.fulfillment.markPaid(tx, order.id);
    expect(await kit.fulfillment.markRefunded(tx, order.id, 'keep')).toEqual({
      changed: true,
      accessRevoked: false,
    });
    expect(kit.enrollmentsOf(studentId)[0]?.revokedAt).toBeNull();
  });

  it('REFUND_POLICY setting: default revoke, accepts "keep" or {value:"keep"}, ignores junk', async () => {
    const { kit, tx } = await setup();
    expect(await getRefundPolicy(tx)).toBe('revoke');
    await kit.db.setting.create({ data: { key: 'refundPolicy', value: { value: 'keep' } } });
    expect(await getRefundPolicy(tx)).toBe('keep');
    kit.db.setting.rows[0]!.value = 'keep';
    expect(await getRefundPolicy(tx)).toBe('keep');
    kit.db.setting.rows[0]!.value = 'delete-everything';
    expect(await getRefundPolicy(tx)).toBe('revoke');
  });
});
