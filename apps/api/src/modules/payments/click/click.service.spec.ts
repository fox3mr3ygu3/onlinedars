import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clickComplete, clickPrepare, TEST_CLICK_SECRET } from '../testing/fixtures';
import { createPaymentsKit, type PaymentsKit } from '../testing/payments-test-kit';
import {
  clickAmountToTiyin,
  ClickErrorCode,
  clickSignString,
  verifyClickSign,
} from './click.errors';

describe('Click sign_string', () => {
  const base = {
    click_trans_id: '2001',
    service_id: '12345',
    merchant_trans_id: '1001',
    amount: '150000',
    action: '0',
    sign_time: '2026-11-23 10:00:00',
  };

  it('Prepare = md5(click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time)', () => {
    const expected = createHash('md5')
      .update(`2001${'12345'}${TEST_CLICK_SECRET}1001150000${'0'}2026-11-23 10:00:00`)
      .digest('hex');
    expect(clickSignString(base, TEST_CLICK_SECRET)).toBe(expected);
  });

  it('Complete includes merchant_prepare_id after merchant_trans_id', () => {
    const p = { ...base, action: '1', merchant_prepare_id: '1001' };
    const expected = createHash('md5')
      .update(`200112345${TEST_CLICK_SECRET}10011001150000${'1'}2026-11-23 10:00:00`)
      .digest('hex');
    expect(clickSignString(p, TEST_CLICK_SECRET)).toBe(expected);
  });

  it('verifies case-insensitively and rejects tampering or a missing secret', () => {
    const sign = clickSignString(base, TEST_CLICK_SECRET);
    expect(verifyClickSign({ ...base, sign_string: sign.toUpperCase() }, TEST_CLICK_SECRET)).toBe(
      true,
    );
    expect(verifyClickSign({ ...base, amount: '1', sign_string: sign }, TEST_CLICK_SECRET)).toBe(
      false,
    );
    expect(verifyClickSign({ ...base, sign_string: sign }, 'other')).toBe(false);
    expect(verifyClickSign({ ...base, sign_string: sign }, undefined)).toBe(false);
  });

  it("converts so'm strings to tiyin", () => {
    expect(clickAmountToTiyin('150000')).toBe(15_000_000);
    expect(clickAmountToTiyin('150000.00')).toBe(15_000_000);
    expect(clickAmountToTiyin('1500.5')).toBe(150_050);
    expect(clickAmountToTiyin('-1')).toBeNull();
    expect(clickAmountToTiyin('1e5')).toBeNull();
  });
});

describe('ClickService (Prepare / Complete)', () => {
  let kit: PaymentsKit;
  let studentId: string;
  let order: { id: string; number: number; amount: number };
  const SUM = '150000'; // course price 15 000 000 tiyin

  beforeEach(async () => {
    kit = createPaymentsKit();
    studentId = (await kit.student()).id;
    const course = await kit.course();
    order = await kit.order(studentId, course);
  });

  async function prepared(amount = SUM) {
    const body = clickPrepare({ orderNumber: order.number, amount });
    const res = await kit.click.prepare(body);
    return { body, res };
  }

  it('happy path: Prepare → Complete marks PAID, enrolls once, notifies once', async () => {
    const { body, res } = await prepared();
    expect(res).toEqual({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: String(order.number),
      merchant_prepare_id: order.number,
      error: 0,
      error_note: 'Success',
    });
    expect(kit.orderRow(order.id).status).toBe('PENDING');

    const done = await kit.click.complete(
      clickComplete({
        orderNumber: order.number,
        amount: SUM,
        clickTransId: body.click_trans_id,
        merchantPrepareId: order.number,
      }),
    );
    expect(done).toMatchObject({ error: 0, merchant_confirm_id: order.number });
    expect(kit.orderRow(order.id)).toMatchObject({ status: 'PAID', provider: 'CLICK' });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
    expect(kit.notificationsOf(studentId)).toHaveLength(1);
  });

  it('duplicate Prepare with the same click_trans_id returns the same answer, one payment row', async () => {
    const { body, res } = await prepared();
    expect(await kit.click.prepare(body)).toEqual(res);
    expect(kit.db.payment.rows).toHaveLength(1);
  });

  it('duplicate Complete → -4 Already paid, enrollment/notification not repeated', async () => {
    const { body } = await prepared();
    const complete = clickComplete({
      orderNumber: order.number,
      amount: SUM,
      clickTransId: body.click_trans_id,
      merchantPrepareId: order.number,
    });
    await kit.click.complete(complete);
    const again = await kit.click.complete(complete);
    expect(again.error).toBe(ClickErrorCode.ALREADY_PAID);
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
    expect(kit.notificationsOf(studentId)).toHaveLength(1);
  });

  it('bad signature → -1 and nothing stored', async () => {
    const body = {
      ...clickPrepare({ orderNumber: order.number, amount: SUM }),
      sign_string: 'deadbeef',
    };
    expect((await kit.click.prepare(body)).error).toBe(ClickErrorCode.SIGN_CHECK_FAILED);
    const wrongSecret = clickPrepare({ orderNumber: order.number, amount: SUM, secret: 'nope' });
    expect((await kit.click.prepare(wrongSecret)).error).toBe(ClickErrorCode.SIGN_CHECK_FAILED);
    expect(kit.db.payment.rows).toHaveLength(0);
  });

  it('amount mismatch → -2 in Prepare and in Complete', async () => {
    expect((await prepared('149999')).res.error).toBe(ClickErrorCode.INCORRECT_AMOUNT);
    const { body } = await prepared();
    const res = await kit.click.complete(
      clickComplete({
        orderNumber: order.number,
        amount: '1000',
        clickTransId: body.click_trans_id,
        merchantPrepareId: order.number,
      }),
    );
    expect(res.error).toBe(ClickErrorCode.INCORRECT_AMOUNT);
    expect(kit.orderRow(order.id).status).toBe('PENDING');
  });

  it('unknown order → -5; missing fields → -8; wrong action → -3; foreign service_id → -8', async () => {
    expect(
      (await kit.click.prepare(clickPrepare({ orderNumber: 999_999, amount: SUM }))).error,
    ).toBe(ClickErrorCode.ORDER_NOT_FOUND);
    expect((await kit.click.prepare({ click_trans_id: '1' })).error).toBe(
      ClickErrorCode.BAD_REQUEST,
    );
    // Correctly signed, but action=1 sent to the Prepare endpoint.
    const { sign_string: _s, ...unsigned } = clickPrepare({
      orderNumber: order.number,
      amount: SUM,
    });
    const wrongAction = { ...unsigned, action: '1' };
    const signed = { ...wrongAction, sign_string: clickSignString(wrongAction, TEST_CLICK_SECRET) };
    expect((await kit.click.prepare(signed)).error).toBe(ClickErrorCode.ACTION_NOT_FOUND);
    const foreign = clickPrepare({ orderNumber: order.number, amount: SUM, serviceId: '99999' });
    expect((await kit.click.prepare(foreign)).error).toBe(ClickErrorCode.BAD_REQUEST);
  });

  it('Complete with an unknown click_trans_id or wrong merchant_prepare_id → -6', async () => {
    const unknown = clickComplete({
      orderNumber: order.number,
      amount: SUM,
      clickTransId: '777',
      merchantPrepareId: order.number,
    });
    expect((await kit.click.complete(unknown)).error).toBe(ClickErrorCode.TRANSACTION_NOT_FOUND);
    const { body } = await prepared();
    const wrongPrep = clickComplete({
      orderNumber: order.number,
      amount: SUM,
      clickTransId: body.click_trans_id,
      merchantPrepareId: 1,
    });
    expect((await kit.click.complete(wrongPrep)).error).toBe(ClickErrorCode.TRANSACTION_NOT_FOUND);
  });

  it('Complete with error < 0 from Click cancels the transaction → -9, no access', async () => {
    const { body } = await prepared();
    const failed = clickComplete({
      orderNumber: order.number,
      amount: SUM,
      clickTransId: body.click_trans_id,
      merchantPrepareId: order.number,
      error: -5017,
    });
    expect((await kit.click.complete(failed)).error).toBe(ClickErrorCode.TRANSACTION_CANCELLED);
    expect(kit.db.payment.rows[0]).toMatchObject({ status: 'CANCELLED', cancelReason: -5017 });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(0);
    // Completing again after the cancel stays -9.
    const retry = clickComplete({
      orderNumber: order.number,
      amount: SUM,
      clickTransId: body.click_trans_id,
      merchantPrepareId: order.number,
    });
    expect((await kit.click.complete(retry)).error).toBe(ClickErrorCode.TRANSACTION_CANCELLED);
  });

  it('Prepare for a paid order → -4; for a cancelled order → -9', async () => {
    kit.orderRow(order.id).status = 'PAID';
    expect((await prepared()).res.error).toBe(ClickErrorCode.ALREADY_PAID);
    kit.orderRow(order.id).status = 'CANCELLED';
    expect((await prepared()).res.error).toBe(ClickErrorCode.TRANSACTION_CANCELLED);
  });

  it('a second Click transaction for an order already paid by the first → -4 on Complete, enrolled once', async () => {
    const a = await prepared();
    const b = await prepared();
    expect(b.res.error).toBe(0);
    await kit.click.complete(
      clickComplete({
        orderNumber: order.number,
        amount: SUM,
        clickTransId: a.body.click_trans_id,
        merchantPrepareId: order.number,
      }),
    );
    const second = await kit.click.complete(
      clickComplete({
        orderNumber: order.number,
        amount: SUM,
        clickTransId: b.body.click_trans_id,
        merchantPrepareId: order.number,
      }),
    );
    expect(second.error).toBe(ClickErrorCode.ALREADY_PAID);
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
  });
});
