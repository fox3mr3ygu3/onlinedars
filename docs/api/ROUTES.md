# API route contract

All routes are under `/api/v1`. Lists return `{ items, total, page, pageSize }`; errors return `{ code, message }` (see `packages/shared/src/errors.ts`).

## Public (`@Public`)

- `GET /courses?search=&directionId=&isFree=&page=&pageSize=`
- `GET /courses/:slug`
- `GET /directions`
- `GET /teachers`
- `GET /faq`
- `GET /certificates/verify/:certificateCode`

## Admin content — backend-content (ADMIN, CONTENT_MANAGER)

- `/admin/courses` (GET, POST)
- `/admin/courses/:id` (GET, PATCH, DELETE)
- `POST /admin/courses/:id/status` `{ status }`
- `/admin/courses/:id/modules` (GET, POST)
- `PATCH /admin/courses/:id/modules/reorder` `{ ids[] }`
- `/admin/modules/:id` (PATCH, DELETE)
- `/admin/modules/:id/lessons` (GET, POST)
- `PATCH /admin/modules/:id/lessons/reorder`
- `/admin/lessons/:id` (GET, PATCH, DELETE)
- `/admin/lessons/:id/materials` (GET, POST)
- `/admin/materials/:id` (PATCH, DELETE)
- `GET /admin/lessons/:id/completeness` → `{ practices: n, required: 4, questionsPerPractice: [...], ready: boolean }`
- `POST /admin/lessons/:id/publish`
- `POST /admin/lessons/:id/unpublish`
- `/admin/lessons/:id/practices` (GET, POST)
- `/admin/practices/:id` (GET, PATCH, DELETE)
- `/admin/practices/:id/questions` (GET, POST)
- `/admin/questions/:id` (PATCH, DELETE)
- `POST /admin/files` (multipart) → `{ id, url }`
- `/admin/directions`, `/admin/teachers`, `/admin/faq` (CRUD)
- `GET/PATCH /admin/settings` (ADMIN only)

## Owned by other agents

`/me/*`, `/admin/courses/:id/exam*`, `/admin/certificate-templates`, `/admin/dashboard`, `/admin/reports/*`, `/admin/students*`, `/orders*`, `/payments/*`, `/admin/payments*`, `/admin/audit-logs`, `/me/notifications*`.
