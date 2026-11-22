import { ErrorCode } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppException } from '../../../common/errors/app.exception';
import {
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  tiyinToSumString,
} from '../core/checkout-url';
import { parseOrderNumber } from '../core/payments-db';
import { createPaymentsKit, type PaymentsKit } from '../testing/payments-test-kit';

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (err) {
    return err instanceof AppException ? err.code : String(err);
  }
}

describe('checkout URLs', () => {
  const order = {
    number: 1042,
    amount: 15_000_050,
    returnUrl: 'https://onlinedars.uz/checkout/c1?orderId=o1',
  };

  it('Payme: base64 of m;ac.order_id;a(tiyin);l;c on the test or production host', () => {
    const url = buildPaymeCheckoutUrl({ merchantId: 'M1', testMode: true }, order);
    expect(url.startsWith('https://checkout.test.paycom.uz/')).toBe(true);
    const decoded = Buffer.from(
      url.replace('https://checkout.test.paycom.uz/', ''),
      'base64',
    ).toString();
    expect(decoded).toBe(`m=M1;ac.order_id=1042;a=15000050;l=uz;c=${order.returnUrl}`);
    expect(buildPaymeCheckoutUrl({ merchantId: 'M1', testMode: false }, order)).toMatch(
      /^https:\/\/checkout\.paycom\.uz\//,
    );
  });

  it("Click: service_id, merchant_id, amount in so'm, transaction_param = order number", () => {
    const url = new URL(buildClickCheckoutUrl({ serviceId: '1', merchantId: '2' }, order));
    expect(url.origin + url.pathname).toBe('https://my.click.uz/services/pay');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      service_id: '1',
      merchant_id: '2',
      amount: '150000.50',
      transaction_param: '1042',
      return_url: order.returnUrl,
    });
    expect(tiyinToSumString(15_000_000)).toBe('150000');
  });

  it('parses order numbers strictly', () => {
    expect(parseOrderNumber('1042')).toBe(1042);
    expect(parseOrderNumber(1042)).toBe(1042);
    expect(parseOrderNumber('10a')).toBeNull();
    expect(parseOrderNumber('-1')).toBeNull();
    expect(parseOrderNumber('0')).toBeNull();
    expect(parseOrderNumber(undefined)).toBeNull();
  });
});

describe('OrdersService', () => {
  let kit: PaymentsKit;

  beforeEach(() => {
    kit = createPaymentsKit();
  });

  it('creates an order with the amount from the DB (client cannot send one) and a redirect URL', async () => {
    const s = await kit.student();
    const course = await kit.course({ price: 12_345_600 });
    const res = await kit.orders.create(s, {
      courseId: course.id,
      provider: 'PAYME',
      // @ts-expect-error — extra client fields are ignored; the schema strips them anyway
      amount: 1,
    });
    expect(res.enrolled).toBe(false);
    if (res.enrolled) return;
    expect(res.amount).toBe(12_345_600);
    expect(kit.orderRow(res.orderId)).toMatchObject({
      amount: 12_345_600,
      status: 'PENDING',
      provider: 'PAYME',
    });
    expect(res.redirectUrl).toMatch(/^https:\/\/checkout\.test\.paycom\.uz\//);
    const decoded = Buffer.from(
      res.redirectUrl.replace('https://checkout.test.paycom.uz/', ''),
      'base64',
    ).toString();
    expect(decoded).toContain(`ac.order_id=${res.number};a=12345600`);
    expect(decoded).toContain(
      `c=https://onlinedars.test/checkout/${course.id}?orderId=${res.orderId}`,
    );
  });

  it('reuses an open order with no transactions; creates a new one once a transaction exists', async () => {
    const s = await kit.student();
    const course = await kit.course();
    const a = await kit.orders.create(s, { courseId: course.id, provider: 'CLICK' });
    const b = await kit.orders.create(s, { courseId: course.id, provider: 'CLICK' });
    expect(!a.enrolled && !b.enrolled && a.orderId === b.orderId).toBe(true);
    if (a.enrolled) return;
    await kit.db.payment.create({
      data: { orderId: a.orderId, provider: 'CLICK', providerTransactionId: '1', amount: a.amount },
    });
    const c = await kit.orders.create(s, { courseId: course.id, provider: 'CLICK' });
    expect(!c.enrolled && c.orderId !== a.orderId).toBe(true);
  });

  it('free course → direct enrollment, no order', async () => {
    const s = await kit.student();
    const course = await kit.course({ isFree: true, price: 0 });
    expect(await kit.orders.create(s, { courseId: course.id, provider: 'PAYME' })).toEqual({
      enrolled: true,
      courseId: course.id,
    });
    expect(kit.db.order.rows).toHaveLength(0);
    expect(kit.enrollmentsOf(s.id)).toEqual([
      expect.objectContaining({ source: 'FREE', revokedAt: null }),
    ]);
  });

  it('rejects: already enrolled (409), unpublished course, unknown course, unconfigured provider', async () => {
    const s = await kit.student();
    const course = await kit.course();
    await kit.db.enrollment.create({
      data: { userId: s.id, courseId: course.id, source: 'ADMIN' },
    });
    expect(await codeOf(kit.orders.create(s, { courseId: course.id, provider: 'PAYME' }))).toBe(
      ErrorCode.ALREADY_ENROLLED,
    );
    const draft = await kit.course({ status: 'DRAFT' });
    expect(await codeOf(kit.orders.create(s, { courseId: draft.id, provider: 'PAYME' }))).toBe(
      ErrorCode.COURSE_NOT_PURCHASABLE,
    );
    expect(await codeOf(kit.orders.create(s, { courseId: 'nope', provider: 'PAYME' }))).toBe(
      ErrorCode.NOT_FOUND,
    );

    const noClick = createPaymentsKit({ CLICK_SECRET_KEY: '' });
    const s2 = await noClick.student();
    const c2 = await noClick.course();
    expect(await codeOf(noClick.orders.create(s2, { courseId: c2.id, provider: 'CLICK' }))).toBe(
      ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
    );
    expect(noClick.db.order.rows).toHaveLength(0);
  });

  it("ownership: a student cannot read another student's order; ADMIN can", async () => {
    const owner = await kit.student('Owner');
    const other = await kit.student('Other');
    const admin = await kit.adminUser();
    const course = await kit.course();
    const order = await kit.order(owner.id, course);
    expect(await codeOf(kit.orders.getOne(other, order.id))).toBe(ErrorCode.FORBIDDEN);
    await expect(kit.orders.getOne(owner, order.id)).resolves.toMatchObject({
      orderId: order.id,
      status: 'PENDING',
      enrolled: false,
    });
    await expect(kit.orders.getOne(admin, order.id)).resolves.toMatchObject({ orderId: order.id });
    expect(await codeOf(kit.orders.getOne(owner, 'missing'))).toBe(ErrorCode.ORDER_NOT_FOUND);
  });
});
