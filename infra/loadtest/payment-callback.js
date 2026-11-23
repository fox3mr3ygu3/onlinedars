// Payme / Click server-to-server callbacks under load, including duplicates (idempotency)
// and wrong amounts. STAGING OR LOCAL ONLY, with TEST merchant keys.
//   k6 run -e BASE_URL=https://staging.onlinedars.uz \
//          -e PAYME_KEY=<test key> -e CLICK_SECRET=<test secret> -e CLICK_SERVICE_ID=<id> \
//          -e ORDER_IDS=ord_1,ord_2,... -e ORDER_AMOUNT_TIYIN=49900000 \
//          infra/loadtest/payment-callback.js
// ORDER_IDS are PENDING staging orders created beforehand (all for the same price).
import http from 'k6/http';
import { check, fail } from 'k6';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';
import { API, guardTarget } from './lib/config.js';

const PAYME_PATH = __ENV.PAYME_PATH || '/payments/payme';
const CLICK_PREPARE_PATH = __ENV.CLICK_PREPARE_PATH || '/payments/click/prepare';
const ORDER_IDS = (__ENV.ORDER_IDS || '').split(',').filter(Boolean);
const AMOUNT = Number(__ENV.ORDER_AMOUNT_TIYIN || 0);

export const options = {
  scenarios: {
    payme: {
      executor: 'constant-arrival-rate',
      exec: 'payme',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '3m',
      preAllocatedVUs: 50,
    },
    click: {
      executor: 'constant-arrival-rate',
      exec: 'click',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '3m',
      preAllocatedVUs: 50,
    },
  },
  thresholds: {
    // Providers time out and retry slow merchants; Payme expects answers well under its timeout.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  guardTarget({ neverProduction: true });
  if (!ORDER_IDS.length || !AMOUNT) fail('set -e ORDER_IDS=... and -e ORDER_AMOUNT_TIYIN=...');
}

function pick() {
  return ORDER_IDS[Math.floor(Math.random() * ORDER_IDS.length)];
}

// ---------- Payme Merchant API (JSON-RPC 2.0, Basic auth "Paycom:<key>") ----------
export function payme() {
  if (!__ENV.PAYME_KEY) fail('set -e PAYME_KEY=<test key>');
  const auth = `Basic ${encoding.b64encode(`Paycom:${__ENV.PAYME_KEY}`)}`;
  const orderId = pick();
  const r = Math.random();
  // 70% valid check, 20% duplicate create for the same provider txn id, 10% wrong amount.
  const amount = r < 0.9 ? AMOUNT : AMOUNT + 100;
  const method = r < 0.7 || r >= 0.9 ? 'CheckPerformTransaction' : 'CreateTransaction';
  const params = { amount, account: { order_id: orderId } };
  if (method === 'CreateTransaction') {
    params.id = `lt-${orderId}`; // same id every time -> must be idempotent
    params.time = Date.now();
  }
  const res = http.post(
    `${API}${PAYME_PATH}`,
    JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      tags: { name: `payme ${method}` },
    },
  );
  // Payme always expects HTTP 200 with either "result" or "error".
  check(res, {
    'payme http 200': (x) => x.status === 200,
    'payme json-rpc body': (x) => hasKey(x, 'result') || hasKey(x, 'error'),
    'payme wrong amount rejected': (x) => amount === AMOUNT || hasKey(x, 'error'),
  });

  // Bad credentials must always be refused.
  if (Math.random() < 0.05) {
    const bad = http.post(
      `${API}${PAYME_PATH}`,
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'CheckPerformTransaction', params }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${encoding.b64encode('Paycom:wrong')}`,
        },
        tags: { name: 'payme bad auth' },
      },
    );
    check(bad, { 'payme bad auth -> error': (x) => hasKey(x, 'error') });
  }
}

// ---------- Click Prepare (form-encoded, sign_string = md5 of fields + secret) ----------
export function click() {
  if (!__ENV.CLICK_SECRET || !__ENV.CLICK_SERVICE_ID)
    fail('set -e CLICK_SECRET=... -e CLICK_SERVICE_ID=...');
  const orderId = pick();
  const clickTransId = String(Math.floor(Math.random() * 1e9));
  const amount = (AMOUNT / 100).toFixed(2); // Click sends sums in so'm, not tiyin
  const action = '0';
  const signTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sign = crypto.md5(
    `${clickTransId}${__ENV.CLICK_SERVICE_ID}${__ENV.CLICK_SECRET}${orderId}${amount}${action}${signTime}`,
    'hex',
  );
  const form = {
    click_trans_id: clickTransId,
    service_id: __ENV.CLICK_SERVICE_ID,
    click_paydoc_id: clickTransId,
    merchant_trans_id: orderId,
    amount,
    action,
    error: '0',
    error_note: 'Success',
    sign_time: signTime,
    sign_string: Math.random() < 0.05 ? 'bad-signature' : sign,
  };
  const res = http.post(`${API}${CLICK_PREPARE_PATH}`, form, { tags: { name: 'click prepare' } });
  check(res, {
    'click http 200': (x) => x.status === 200,
    'click bad sign rejected': (x) => form.sign_string === sign || Number(safe(x, 'error')) < 0,
  });
}

function hasKey(res, key) {
  try {
    return Object.prototype.hasOwnProperty.call(res.json(), key);
  } catch (_e) {
    return false;
  }
}

function safe(res, path) {
  try {
    return res.json(path);
  } catch (_e) {
    return undefined;
  }
}
