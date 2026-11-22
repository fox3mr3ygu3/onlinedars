# Payments (Payme, Click) — integration notes

Owner: `backend-payments`. Code: `apps/api/src/modules/payments/`, `audit/`, `notifications/`,
`apps/api/src/jobs/payment-recheck.job.ts`. Business rule 8 in `CLAUDE.md` is the contract:
**access is granted only by a verified provider server-to-server callback**, never by the browser
redirect; amounts come from our DB; callbacks are idempotent.

## Money and identifiers

- All amounts are integer **tiyin** (1 so'm = 100 tiyin), currency `UZS`.
  Payme sends tiyin; Click sends so'm (`"250000"` or `"250000.00"`), converted and compared exactly.
- `Order.id` (cuid) is our internal id; `Order.number` (sequential int) is what providers see:
  Payme `account.order_id`, Click `merchant_trans_id` / `transaction_param`.
  Click's `merchant_prepare_id` and `merchant_confirm_id` are also the order number.
- `Payment` = one provider transaction, unique on `(provider, providerTransactionId)`.

## Flow

```
Student ── POST /api/v1/orders {courseId, provider} ──► API
            amount = Course.price (DB); free course → enrolled, no order
        ◄── {enrolled:false, orderId, number, amount, redirectUrl}
Browser ──► provider checkout (redirectUrl) ──► pays
Provider ── server-to-server callbacks ──► /api/v1/payments/payme | /click/prepare | /click/complete
            verify auth/signature → lock order row → check amount/status →
            ONE DB transaction: payment status + order PAID + enrollment + in-app notification
Browser ◄── provider redirects to WEB_URL/checkout/{courseId}?orderId={orderId}
Web page polls GET /api/v1/orders/{orderId} until status PAID (enrolled:true) — the redirect itself proves nothing.
```

Order statuses: `PENDING → PAID → REFUNDED`, `PENDING → CANCELLED | FAILED`.
A pending order expires 24 h after creation (re-check job cancels it if no transaction is open).
An open order with no provider transaction is reused when the student clicks "Buy" again.

## Endpoints

| Method | Path                         | Auth              | Notes                                                                                                                                                       |
| ------ | ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/orders`                    | signed-in         | `{courseId, provider: "PAYME"\|"CLICK"}`; 409 `ALREADY_ENROLLED`, 400 `COURSE_NOT_PURCHASABLE`, 503 `PAYMENT_PROVIDER_UNAVAILABLE`                          |
| GET    | `/orders/:orderId`           | owner or ADMIN    | the status the web polls; 403 for other students                                                                                                            |
| GET    | `/me/orders`                 | signed-in         | own history, `?status=&page=&pageSize=`                                                                                                                     |
| POST   | `/payments/payme`            | Payme Basic auth  | JSON-RPC, always HTTP 200                                                                                                                                   |
| POST   | `/payments/click/prepare`    | Click sign_string | form-urlencoded, always HTTP 200                                                                                                                            |
| POST   | `/payments/click/complete`   | Click sign_string | form-urlencoded, always HTTP 200                                                                                                                            |
| GET    | `/admin/payments`            | ADMIN             | `?status=&provider=&courseId=&userId=&search=&minAmount=&maxAmount=&from=&to=&page=&pageSize=`; `search` = order number, order id, student name/email/phone |
| PATCH  | `/admin/payments/:id/status` | ADMIN             | `id` = orderId; `{status, reason}` (reason ≥ 5 chars); audited                                                                                              |
| GET    | `/admin/audit-logs`          | ADMIN             | `?entityType=&entityId=&actorId=&action=&from=&to=`                                                                                                         |
| GET    | `/me/notifications`          | signed-in         | `?unreadOnly=true`; response has `unreadCount`                                                                                                              |
| POST   | `/me/notifications/:id/read` | owner             | 404 for someone else's id                                                                                                                                   |
| POST   | `/me/notifications/read-all` | signed-in         |                                                                                                                                                             |

All under `/api/v1`. Lists return `{items, total, page, pageSize}`; errors `{statusCode, code, message}`.

Admin manual transitions: `PENDING → PAID | CANCELLED | FAILED`, `CANCELLED | FAILED → PAID`,
`PAID → REFUNDED`. Anything else → 409 `INVALID_STATUS_TRANSITION`. Each change writes an
`AuditLog` row (`action=payment.status.change`, `entityType=Order`, actor, before/after,
reason, ip, user agent) in the same DB transaction.

## Callback URLs to register

| Provider | Where                             | URL                                                   |
| -------- | --------------------------------- | ----------------------------------------------------- |
| Payme    | merchant cabinet → "Endpoint URL" | `https://<api-domain>/api/v1/payments/payme`          |
| Payme    | account field                     | `order_id` (type number / string, our order number)   |
| Click    | merchant cabinet → Prepare URL    | `https://<api-domain>/api/v1/payments/click/prepare`  |
| Click    | merchant cabinet → Complete URL   | `https://<api-domain>/api/v1/payments/click/complete` |

Env (`.env.example`): `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_MODE`, `PAYME_IKPU_CODE`,
`PAYME_PACKAGE_CODE`, `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`,
`PAYMENT_RECHECK_INTERVAL_MINUTES`. A provider without credentials is reported as unavailable
(503 on POST /orders) and its callbacks reject every request.

The callback routes are `@Public()` (no JWT) and are not throttled (the throttler is not global);
they authenticate with the provider's own scheme.

## Payme Merchant API

Auth: `Authorization: Basic base64("Paycom:" + PAYME_KEY)`, compared in constant time.
Response shape: `{id, result}` or `{id, error: {code, message: {ru, uz, en}, data?}}`.

| Method                  | Behaviour                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CheckPerformTransaction | order exists, amount equal, order PENDING and not expired, student not already enrolled → `{allow: true}` (+ `detail` fiscal receipt when `PAYME_IKPU_CODE` and `PAYME_PACKAGE_CODE` are set)                   |
| CreateTransaction       | same id again → same `{create_time, transaction, state:1}`; timed-out (12 h) → cancelled with reason 4 and -31008; another open transaction on the order → -31099                                               |
| PerformTransaction      | state 1 → order PAID + enrollment + notification, `{transaction, perform_time, state:2}`; state 2 → same result again (nothing re-granted); cancelled / timed out / order no longer PENDING → -31008            |
| CancelTransaction       | state 1 → state -1 (order stays PENDING, student can retry); state 2 → refund: state -2, order REFUNDED, access revoked or kept per `REFUND_POLICY`, AuditLog `payment.refund`; already cancelled → same result |
| CheckTransaction        | `{create_time, perform_time, cancel_time, transaction, state, reason}` (0 for unset times)                                                                                                                      |
| GetStatement            | transactions whose Payme `time` is in `[from, to]`                                                                                                                                                              |
| ChangePassword / others | -32601 (the key lives in env; rotate it by changing `PAYME_KEY` and redeploying)                                                                                                                                |

| Code   | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| -32504 | wrong / missing Basic auth                                                                   |
| -32600 | invalid JSON-RPC request or params                                                           |
| -32601 | method not found                                                                             |
| -32400 | internal error (logged)                                                                      |
| -31001 | amount does not match the order                                                              |
| -31003 | transaction not found                                                                        |
| -31008 | operation not possible in this state, or 12 h timeout                                        |
| -31050 | order not found (`data: "order_id"`)                                                         |
| -31051 | order already paid / cancelled / expired, or student already has access (`data: "order_id"`) |
| -31099 | another transaction for this order is in progress (`data: "order_id"`)                       |

States: `1` created, `2` performed, `-1` cancelled before perform, `-2` cancelled after perform.
Mapping: `PENDING=1`, `PAID=2`, `CANCELLED/FAILED=-1` (or -2 if it had been performed), `REFUNDED=-2`.

Known gap: a malformed JSON body is rejected by Express's body parser before our handler, so it
gets our generic 400 instead of Payme's -32700. Payme never sends malformed JSON in practice.

## Click SHOP-API

Sign check (MD5, hex, lower-case, compared in constant time; values concatenated exactly as received):

- Prepare: `md5(click_trans_id + service_id + CLICK_SECRET_KEY + merchant_trans_id + amount + action + sign_time)`
- Complete: `md5(click_trans_id + service_id + CLICK_SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)`

Response: `{click_trans_id, merchant_trans_id, merchant_prepare_id | merchant_confirm_id, error, error_note}`.

| Code | error_note                  | When                                                                                                                                               |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Success                     |                                                                                                                                                    |
| -1   | SIGN CHECK FAILED!          | bad signature or no secret configured                                                                                                              |
| -2   | Incorrect parameter amount  | amount ≠ order amount                                                                                                                              |
| -3   | Action not found            | action not 0 on prepare / 1 on complete                                                                                                            |
| -4   | Already paid                | order already PAID; **repeated Complete of a paid transaction** (Click's documented answer — no second enrollment)                                 |
| -5   | User does not exist         | order number unknown                                                                                                                               |
| -6   | Transaction does not exist  | Complete for an unknown click_trans_id / wrong merchant_prepare_id                                                                                 |
| -7   | Failed to update user       | internal error (logged)                                                                                                                            |
| -8   | Error in request from click | missing fields, or `service_id` is not ours                                                                                                        |
| -9   | Transaction cancelled       | order cancelled/expired, transaction already cancelled, Click sent `error < 0` on Complete (we cancel), or the order has an open Payme transaction |

Repeated Prepare with the same `click_trans_id` returns the same `merchant_prepare_id`.

## Refunds

- Payme: `CancelTransaction` on a performed transaction (Payme cabinet refund).
- Click: no refund callback in SHOP-API; refund in the Click cabinet, then an ADMIN sets the
  order `PAID → REFUNDED` in the admin panel (reason required, audited).
- Setting `REFUND_POLICY` (`Setting.key = "REFUND_POLICY"`, value `"revoke"` or `"keep"`,
  or `{"value": "keep"}`): `revoke` (default) revokes the enrollment granted by that order,
  `keep` leaves access.

## Stuck payments (worker job `payment-recheck`)

Every `PAYMENT_RECHECK_INTERVAL_MINUTES` (default 10, 0 = off) the worker:

1. takes PENDING payments older than 15 min and asks `PaymentStatusChecker` (default: answers
   UNKNOWN, no provider API calls); PAID → same fulfilment as a callback, CANCELLED → cancelled;
   UNKNOWN past the provider timeout (Payme 12 h → reason 4, Click Prepare without Complete 1 h)
   → cancelled;
2. cancels PENDING orders past `expiresAt` with no open transaction.

With `REDIS_URL` set it is a BullMQ job scheduler (one run at a time across replicas); without
it the worker runs it on an in-process interval.

## Notifications

On every first transition to PAID an in-app `Notification` (`type=PAYMENT_SUCCESS`, `data` =
courseId, courseTitle, courseSlug, orderId, orderNumber) is created in the same transaction.
`title`/`body` are Uzbek fallback text; the web should render its own i18n text from `type` + `data`.
Email/SMS go through `EmailSender` / `NotificationSmsSender` (no-op by default) after commit.

## Test procedure

Automated (no credentials needed):

- `pnpm --filter @onlinedars/api test` — unit tests on an in-memory DB: every Payme method
  (auth fail, wrong amount, unknown order, paid order, duplicate Create/Perform, cancel before
  and after perform, timeouts, statement), Click signature + prepare/complete + duplicates +
  amount mismatch, enrollment-once, refund policy, admin transitions + audit, ownership.
- `pnpm --filter @onlinedars/api test:e2e` — `test/payments.e2e-spec.ts`, real HTTP + Postgres,
  realistic provider payloads from `src/modules/payments/testing/fixtures.ts` (runs in CI).

With provider sandboxes (needs test credentials — see `docs/USER_ACTIONS.md`):

1. Payme: put the test merchant ID + **test key** in staging env (`PAYME_TEST_MODE=true`).
   In the Payme sandbox (`test.paycom.uz`) set the endpoint URL to staging and run the full
   test suite there (it calls every method, wrong amounts, wrong order ids, wrong auth,
   repeated calls). Create a fresh order (`POST /orders`) for each scenario that needs one.
   Then pay through `checkout.test.paycom.uz` with Payme's test card and confirm the
   order turns PAID by polling `GET /orders/:id`.
2. Click: register staging Prepare/Complete URLs with Click's test service, open the
   `redirectUrl` from `POST /orders`, pay with Click's test card, check the order is PAID.
   Click's support runs their own callback checks (signature, amount, duplicates) on request.
3. Refund: cancel a performed Payme transaction from the sandbox → order REFUNDED, access
   revoked (default policy), AuditLog row `payment.refund`.
