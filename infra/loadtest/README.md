# k6 load tests

Install k6 (`winget install k6 --source winget`, or `brew install k6`). Run against **staging** or local only;
the scripts refuse other hosts (payment callbacks never run outside staging/local).

| Script                 | What it simulates                                                                                                                 | Pass criteria (thresholds)                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `catalog-browse.js`    | anonymous visitors: catalog, search, directions, course page                                                                      | errors < 1 %, API p95 < 400 ms, page p95 < 1.2 s                            |
| `exam-submit-spike.js` | `STUDENTS` (default 1,000) start and submit the final exam within the same few minutes                                            | submit errors < 1 %, submit p95 < 1.5 s, no correct answers in exam payload |
| `payment-callback.js`  | Payme JSON-RPC + Click Prepare callbacks at a constant rate, incl. duplicate CreateTransaction, wrong amounts, bad auth/signature | p95 < 500 ms, every wrong amount / bad signature rejected                   |

```bash
k6 run -e BASE_URL=https://staging.onlinedars.uz infra/loadtest/catalog-browse.js
k6 run -e BASE_URL=https://staging.onlinedars.uz -e EXAM_ID=... -e STUDENTS=1000 -e STUDENT_PASSWORD=... infra/loadtest/exam-submit-spike.js
k6 run -e BASE_URL=https://staging.onlinedars.uz -e PAYME_KEY=... -e CLICK_SECRET=... -e CLICK_SERVICE_ID=... \
       -e ORDER_IDS=a,b,c -e ORDER_AMOUNT_TIYIN=49900000 infra/loadtest/payment-callback.js
```

Common options: `-e VUS=`, `-e HOLD=5m`, `-e RATE=`, `-e DURATION=`, `-e API_PREFIX=/api/v1`.
Endpoint paths that are not final yet can be overridden (`EXAM_START_PATH`, `EXAM_SUBMIT_PATH`,
`PAYME_PATH`, `CLICK_PREPARE_PATH`).

Before the exam spike, create load-test students on staging only (`loadtest+1@example.test` …,
override with `STUDENT_EMAIL_PATTERN`), enrolled in a course with all lessons complete.
Never put real keys in these files; pass them with `-e` from the password manager.

Record results (date, git tag, VUs, p95, errors, server size) in `docs/DEPLOYMENT.md` → "Scaling stages".
