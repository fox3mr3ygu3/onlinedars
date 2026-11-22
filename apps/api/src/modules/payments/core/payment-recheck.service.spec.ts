import { describe, expect, it } from 'vitest';
import { PAYME_TX_TIMEOUT_MS } from '../payme/payme.errors';
import { createPaymentsKit } from '../testing/payments-test-kit';
import {
  CLICK_PREPARE_TIMEOUT_MS,
  type PaymentStatusChecker,
  type ProviderPaymentState,
} from './payment-recheck.service';

const checker = (state: ProviderPaymentState): PaymentStatusChecker => ({
  check: async () => state,
});

async function setup(state: ProviderPaymentState = 'UNKNOWN') {
  const kit = createPaymentsKit({}, checker(state));
  const s = await kit.student();
  const order = await kit.order(s.id, await kit.course());
  return { kit, studentId: s.id, order };
}

const ago = (ms: number) => new Date(Date.now() - ms);

describe('PaymentRecheckService', () => {
  it('provider says PAID → order PAID and enrolled once (second run changes nothing)', async () => {
    const { kit, studentId, order } = await setup('PAID');
    await kit.db.payment.create({
      data: {
        orderId: order.id,
        provider: 'CLICK',
        providerTransactionId: '9',
        amount: order.amount,
        createdAt: ago(20 * 60_000),
      },
    });
    expect(await kit.recheck.run()).toMatchObject({ checked: 1, paid: 1 });
    expect(kit.orderRow(order.id).status).toBe('PAID');
    expect(await kit.recheck.run()).toMatchObject({ checked: 0, paid: 0 });
    expect(kit.enrollmentsOf(studentId)).toHaveLength(1);
  });

  it('unknown status: fresh payments are left alone, timed-out ones are cancelled (Payme reason 4)', async () => {
    const { kit, order } = await setup('UNKNOWN');
    await kit.db.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYME',
        providerTransactionId: 'young',
        amount: order.amount,
        createdAt: ago(60 * 60_000),
      },
    });
    await kit.db.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYME',
        providerTransactionId: 'old',
        amount: order.amount,
        createdAt: ago(PAYME_TX_TIMEOUT_MS + 60_000),
      },
    });
    await kit.db.payment.create({
      data: {
        orderId: order.id,
        provider: 'CLICK',
        providerTransactionId: 'c-old',
        amount: order.amount,
        createdAt: ago(CLICK_PREPARE_TIMEOUT_MS + 60_000),
      },
    });
    const summary = await kit.recheck.run();
    expect(summary).toMatchObject({ checked: 3, cancelled: 2, paid: 0 });
    const byTx = (id: string) => kit.db.payment.rows.find((p) => p.providerTransactionId === id);
    expect(byTx('young')?.status).toBe('PENDING');
    expect(byTx('old')).toMatchObject({ status: 'CANCELLED', cancelReason: 4 });
    expect(byTx('c-old')).toMatchObject({ status: 'CANCELLED' });
    expect(kit.orderRow(order.id).status).toBe('PENDING');
  });

  it('expires PENDING orders past expiresAt, but not while a transaction is open', async () => {
    const { kit, order } = await setup();
    kit.orderRow(order.id).expiresAt = ago(1000);
    await kit.db.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYME',
        providerTransactionId: 'open',
        amount: order.amount,
      },
    });
    expect((await kit.recheck.run()).expiredOrders).toBe(0);
    kit.db.payment.rows[0]!.status = 'CANCELLED';
    expect((await kit.recheck.run()).expiredOrders).toBe(1);
    expect(kit.orderRow(order.id).status).toBe('CANCELLED');
  });
});
