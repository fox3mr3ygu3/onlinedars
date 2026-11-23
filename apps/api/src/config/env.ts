import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Loads the repo-root `.env` (if present) into process.env. Real env vars win. */
export function loadDotEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  /** Unset/empty: no BullMQ — PDFs render inline and the payment re-check runs in-process. */
  REDIS_URL: optionalString,
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().default('onlinedars'),
  S3_PUBLIC_URL: optionalString,
  ESKIZ_EMAIL: optionalString,
  ESKIZ_PASSWORD: optionalString,
  ESKIZ_FROM: z.string().default('4546'),
  SENTRY_DSN: optionalString,
  WEB_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000/api/v1'),
  /** Comma-separated extra CORS origins. WEB_URL is always allowed. */
  CORS_ORIGINS: optionalString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // ── Payments (all optional; a provider is disabled until its credentials are set) ──
  PAYME_MERCHANT_ID: optionalString,
  /** Merchant key (test key on staging). Payme sends `Basic base64("Paycom:<key>")`. */
  PAYME_KEY: optionalString,
  /** true → checkout.test.paycom.uz, false → checkout.paycom.uz. */
  PAYME_TEST_MODE: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  /** Optional fiscal receipt data (IKPU / package code from tasnif.soliq.uz). */
  PAYME_IKPU_CODE: optionalString,
  PAYME_PACKAGE_CODE: optionalString,
  CLICK_SERVICE_ID: optionalString,
  CLICK_MERCHANT_ID: optionalString,
  CLICK_SECRET_KEY: optionalString,
  /** Minutes between stuck-payment re-checks in the worker; 0 disables the schedule. */
  PAYMENT_RECHECK_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(10),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
