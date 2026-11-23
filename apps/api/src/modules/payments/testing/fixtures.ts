/**
 * Provider payload fixtures shaped exactly like the requests Payme and Click send
 * (field names, types and formats from their docs). Shared by unit and e2e tests.
 * Credentials here are fake test values, never real ones.
 */
import { clickSignString } from '../click/click.errors';

export const TEST_PAYME_MERCHANT_ID = '5e730e8e0b852a417aa49ceb';
export const TEST_PAYME_KEY = 'test-payme-key-&N7x?Qp2#';
export const TEST_CLICK_SERVICE_ID = '12345';
export const TEST_CLICK_MERCHANT_ID = '67890';
export const TEST_CLICK_SECRET = 'test-click-secret-key';

export const paymeAuthHeader = (key: string = TEST_PAYME_KEY, login = 'Paycom'): string =>
  `Basic ${Buffer.from(`${login}:${key}`).toString('base64')}`;

let rpcId = 1000;
const rpc = (method: string, params: Record<string, unknown>) => ({ method, params, id: ++rpcId });

/** A Payme transaction id: 24 hex chars, like the real ones. */
export const paymeTxId = (): string =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export const payme = {
  checkPerform: (orderNumber: number | string, amount: number) =>
    rpc('CheckPerformTransaction', { amount, account: { order_id: String(orderNumber) } }),
  create: (id: string, orderNumber: number | string, amount: number, time: number = Date.now()) =>
    rpc('CreateTransaction', { id, time, amount, account: { order_id: String(orderNumber) } }),
  perform: (id: string) => rpc('PerformTransaction', { id }),
  cancel: (id: string, reason = 5) => rpc('CancelTransaction', { id, reason }),
  check: (id: string) => rpc('CheckTransaction', { id }),
  statement: (from: number, to: number) => rpc('GetStatement', { from, to }),
};

let clickSeq = 2_000_000;

interface ClickBase {
  orderNumber: number | string;
  /** So'm, as Click formats it (e.g. "150000" or "150000.00"). */
  amount: string;
  clickTransId?: string;
  secret?: string;
  serviceId?: string;
  error?: number;
}

const signTime = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** Click Prepare (action=0) form body, signed with the test secret. */
export function clickPrepare(o: ClickBase) {
  const body = {
    click_trans_id: o.clickTransId ?? String(++clickSeq),
    service_id: o.serviceId ?? TEST_CLICK_SERVICE_ID,
    click_paydoc_id: String(clickSeq + 500_000),
    merchant_trans_id: String(o.orderNumber),
    amount: o.amount,
    action: '0',
    error: String(o.error ?? 0),
    error_note: 'Success',
    sign_time: signTime(),
  };
  return { ...body, sign_string: clickSignString(body, o.secret ?? TEST_CLICK_SECRET) };
}

/** Click Complete (action=1) form body for the same click_trans_id. */
export function clickComplete(
  o: ClickBase & { clickTransId: string; merchantPrepareId: number | string },
) {
  const body = {
    click_trans_id: o.clickTransId,
    service_id: o.serviceId ?? TEST_CLICK_SERVICE_ID,
    click_paydoc_id: String(Number(o.clickTransId) + 500_000),
    merchant_trans_id: String(o.orderNumber),
    merchant_prepare_id: String(o.merchantPrepareId),
    amount: o.amount,
    action: '1',
    error: String(o.error ?? 0),
    error_note: o.error && o.error < 0 ? 'Payment failed' : 'Success',
    sign_time: signTime(),
  };
  return { ...body, sign_string: clickSignString(body, o.secret ?? TEST_CLICK_SECRET) };
}

/** Env values for tests (both providers configured with fake credentials). */
export const TEST_PAYMENT_ENV = {
  PAYME_MERCHANT_ID: TEST_PAYME_MERCHANT_ID,
  PAYME_KEY: TEST_PAYME_KEY,
  PAYME_TEST_MODE: 'true',
  CLICK_SERVICE_ID: TEST_CLICK_SERVICE_ID,
  CLICK_MERCHANT_ID: TEST_CLICK_MERCHANT_ID,
  CLICK_SECRET_KEY: TEST_CLICK_SECRET,
} as const;
