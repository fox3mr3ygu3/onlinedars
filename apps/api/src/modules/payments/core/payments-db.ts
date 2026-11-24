import {
  EnrollmentMode,
  type PaymentStatus,
  platformSettingsSchema,
  REFUND_POLICY_SETTING_KEY,
  PaymentRefundPolicy,
  paymentRefundPolicySchema,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';

/** A Prisma transaction client (what `$transaction(async (tx) => …)` hands you). */
export type Tx = Prisma.TransactionClient;

/** A paid order stays payable this long after creation (then the re-check job cancels it). */
export const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Locks the order row until the transaction ends, so concurrent provider callbacks for the
 * same order (e.g. two CreateTransaction calls) are processed one after another.
 */
export async function lockOrder(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}

/** Statuses a payment/order can be in while still awaiting money. */
export const OPEN_STATUSES: readonly PaymentStatus[] = ['PENDING'];

/**
 * Reads the `REFUND_POLICY` platform setting: `revoke` (default) removes course access after a
 * refund, `keep` leaves it. Accepts `"keep"` or `{ "value": "keep" }` as the stored JSON.
 */
export async function getRefundPolicy(db: Pick<Tx, 'setting'>): Promise<PaymentRefundPolicy> {
  const row = await db.setting.findUnique({ where: { key: REFUND_POLICY_SETTING_KEY } });
  const raw: unknown =
    row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
      ? (row.value as Record<string, unknown>).value
      : row?.value;
  const parsed = paymentRefundPolicySchema.safeParse(raw);
  return parsed.success ? parsed.data : PaymentRefundPolicy.REVOKE;
}

/**
 * Reads the `enrollmentMode` platform setting. Missing or invalid → ADMIN_ONLY (the safe default:
 * nobody gets access without an admin grant).
 */
export async function getEnrollmentMode(db: Pick<Tx, 'setting'>): Promise<EnrollmentMode> {
  const row = await db.setting.findUnique({ where: { key: 'enrollmentMode' } });
  const parsed = platformSettingsSchema.shape.enrollmentMode.safeParse(row?.value);
  return parsed.success ? parsed.data : EnrollmentMode.ADMIN_ONLY;
}

/** Order number sent to providers (Payme `account.order_id`, Click `merchant_trans_id`). */
export function parseOrderNumber(value: unknown): number | null {
  const s =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}
