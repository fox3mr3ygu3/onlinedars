# API route contract (Phase 1)

Agreed by the coordinator for the parallel backend/frontend agents. All under `/api/v1`;
lists return `{items, total, page, pageSize}`; errors `{code, message}` (plus `statusCode`).

## Payments (backend-payments)

- `POST /orders` `{courseId, provider: "PAYME"|"CLICK"}` → `{orderId, number, amount, redirectUrl}` (free course → `{enrolled: true}`)
- `GET /orders/:orderId` (own; the web polls status)
- `GET /me/orders`
- `POST /payments/payme` (JSON-RPC)
- `POST /payments/click/prepare`
- `POST /payments/click/complete`
- `GET /admin/payments?status=&provider=&courseId=&search=&from=&to=`
- `PATCH /admin/payments/:id/status` `{status, reason}` (ADMIN)
- `GET /admin/audit-logs`
- `GET /me/notifications`
- `POST /me/notifications/:id/read`

Others own `/courses*`, `/admin` content CRUD, `/me/*` learning routes and `/admin/students*`.
backend-learning writes AuditLog rows for enrollment grants/revokes through the exported
`AuditService` (`apps/api/src/modules/audit/audit.service.ts`, global module).

### Implementation notes (backend-payments, all additive to the contract)

- `POST /orders` paid response also has `enrolled: false`, `currency`, `provider`, `status`;
  free response is `{enrolled: true, courseId}`. Discriminate on `enrolled`. Zod:
  `createOrderResponseSchema` in `packages/shared/src/schemas/payments.ts`.
- Provider return URL: `WEB_URL/checkout/{courseId}?orderId={orderId}` — the checkout page
  should poll `GET /orders/:orderId` when `orderId` is in the query.
- `GET /orders/:orderId` and `/me/orders` items: `orderSchema` (`orderId, number, status,
courseId, courseTitle, courseSlug, amount, currency, provider, enrolled, paidAt, cancelledAt,
expiresAt, createdAt`).
- `GET /admin/payments` also accepts `userId`, `minAmount`, `maxAmount` (tiyin), `page`,
  `pageSize`; one row per order with `student` and `transactions[]`. `:id` in the PATCH is the
  **orderId**. Allowed transitions and audit details: `docs/api/payments.md`.
- `GET /admin/audit-logs` filters: `entityType, entityId, actorId, action, from, to`.
- `GET /me/notifications?unreadOnly=true` returns `unreadCount` too; extra
  `POST /me/notifications/read-all`.
