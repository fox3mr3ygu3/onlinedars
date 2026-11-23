import { ErrorCode, paymentListQuerySchema } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import { toAuditJson } from '../../audit/audit.service';
import { createPaymentsKit, type PaymentsKit } from '../testing/payments-test-kit';
import { buildAdminPaymentWhere, isAllowedAdminTransition } from './admin-payments.service';

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (err) {
    return err instanceof AppException ? err.code : String(err);
  }
}

describe('admin payment status transitions', () => {
  it.each([
    ['PENDING', 'PAID', true],
    ['PENDING', 'CANCELLED', true],
    ['PENDING', 'FAILED', true],
    ['CANCELLED', 'PAID', true],
    ['FAILED', 'PAID', true],
    ['PAID', 'REFUNDED', true],
    ['PAID', 'CANCELLED', false],
    ['PAID', 'PENDING', false],
    ['REFUNDED', 'PAID', false],
    ['PENDING', 'REFUNDED', false],
    ['PENDING', 'PENDING', false],
  ] as const)('%s → %s allowed=%s', (from, to, allowed) => {
    expect(isAllowedAdminTransition(from, to)).toBe(allowed);
  });
});

describe('buildAdminPaymentWhere', () => {
  it('maps every filter', () => {
    const q = paymentListQuerySchema.parse({
      status: 'PAID',
      provider: 'CLICK',
      courseId: 'c1',
      userId: 'u1',
      minAmount: '100',
      maxAmount: '900',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T00:00:00.000Z',
      search: '#1042',
    });
    const where = buildAdminPaymentWhere(q);
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: 'PAID' },
        { provider: 'CLICK' },
        { courseId: 'c1' },
        { userId: 'u1' },
        { amount: { gte: 100, lte: 900 } },
        {
          createdAt: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-30T00:00:00.000Z'),
          },
        },
      ]),
    );
    const search = (where.AND as { OR?: unknown[] }[]).find((x) => x.OR)?.OR;
    expect(search).toEqual(expect.arrayContaining([{ number: 1042 }, { id: '1042' }]));
  });

  it('no filters → {}; text search does not add a number clause', () => {
    expect(buildAdminPaymentWhere(paymentListQuerySchema.parse({}))).toEqual({});
    const where = buildAdminPaymentWhere(paymentListQuerySchema.parse({ search: 'Ali' }));
    const or = (where.AND as { OR: unknown[] }[])[0]?.OR ?? [];
    expect(or).not.toContainEqual(expect.objectContaining({ number: expect.anything() }));
  });
});

describe('AdminPaymentsService.changeStatus', () => {
  let kit: PaymentsKit;
  let studentId: string;
  let order: { id: string };

  beforeEach(async () => {
    kit = createPaymentsKit();
    studentId = (await kit.student()).id;
    order = await kit.order(studentId, await kit.course());
  });

  it('PENDING → PAID grants access once and writes an audit row with actor, before/after and reason', async () => {
    const admin = await kit.adminUser();
    const view = await kit.admin.changeStatus(
      admin,
      order.id,
      { status: 'PAID', reason: 'Bank transfer confirmed' },
      { ip: '10.0.0.1', userAgent: 'vitest' },
    );
    expect(view).toMatchObject({ status: 'PAID', enrolled: true, student: { id: studentId } });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
    expect(kit.db.auditLog.rows).toEqual([
      expect.objectContaining({
        actorId: admin.id,
        action: 'payment.status.change',
        entityType: 'Order',
        entityId: order.id,
        reason: 'Bank transfer confirmed',
        ip: '10.0.0.1',
        userAgent: 'vitest',
        before: expect.objectContaining({ status: 'PENDING', enrolled: false }),
        after: expect.objectContaining({ status: 'PAID', enrolled: true }),
      }),
    ]);
  });

  it('PAID → REFUNDED revokes access by default and records the policy', async () => {
    const admin = await kit.adminUser();
    await kit.admin.changeStatus(admin, order.id, { status: 'PAID', reason: 'manual payment' });
    await kit.admin.changeStatus(admin, order.id, {
      status: 'REFUNDED',
      reason: 'refund requested',
    });
    expect(kit.orderRow(order.id).status).toBe('REFUNDED');
    expect(kit.enrollmentsOf(studentId)[0]?.revokedAt).toBeInstanceOf(Date);
    expect(kit.db.auditLog.rows[1]).toMatchObject({
      after: expect.objectContaining({
        status: 'REFUNDED',
        enrolled: false,
        refundPolicy: 'revoke',
      }),
    });
  });

  it('a disallowed transition → INVALID_STATUS_TRANSITION, nothing changed, no audit row', async () => {
    const admin = await kit.adminUser();
    expect(
      await codeOf(
        kit.admin.changeStatus(admin, order.id, { status: 'REFUNDED', reason: 'not paid yet' }),
      ),
    ).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    expect(kit.orderRow(order.id).status).toBe('PENDING');
    expect(kit.db.auditLog.rows).toHaveLength(0);
  });

  it('unknown order → ORDER_NOT_FOUND', async () => {
    const admin = await kit.adminUser();
    expect(
      await codeOf(
        kit.admin.changeStatus(admin, 'missing', { status: 'PAID', reason: 'whatever' }),
      ),
    ).toBe(ErrorCode.ORDER_NOT_FOUND);
  });

  it('PENDING → CANCELLED closes the order without touching enrollments', async () => {
    const admin = await kit.adminUser();
    await kit.admin.changeStatus(admin, order.id, { status: 'CANCELLED', reason: 'abandoned' });
    expect(kit.orderRow(order.id)).toMatchObject({ status: 'CANCELLED' });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(0);
  });
});

describe('AuditService', () => {
  it('stores JSON-safe before/after (Dates, BigInt) and omits undefined', async () => {
    const kit = createPaymentsKit();
    await kit.audit.log({
      action: 'enrollment.grant',
      entityType: 'Enrollment',
      entityId: 'e1',
      after: { at: new Date('2026-11-23T00:00:00.000Z'), big: 5n },
    });
    expect(kit.db.auditLog.rows[0]).toMatchObject({
      actorId: null,
      before: undefined,
      after: { at: '2026-11-23T00:00:00.000Z', big: '5' },
    });
    expect(toAuditJson(undefined)).toBeUndefined();
  });

  it('lists newest first with the actor', async () => {
    const kit = createPaymentsKit();
    const admin = await kit.adminUser();
    await kit.audit.log({ actorId: admin.id, action: 'a', entityType: 'Order', entityId: '1' });
    await new Promise((r) => setTimeout(r, 2));
    await kit.audit.log({ actorId: admin.id, action: 'b', entityType: 'Order', entityId: '2' });
    const page = await kit.audit.list({ page: 1, pageSize: 20, entityType: 'Order' });
    expect(page.total).toBe(2);
    expect(page.items.map((i) => i.action)).toEqual(['b', 'a']);
    expect(page.items[0]?.actor).toMatchObject({ id: admin.id });
  });
});
