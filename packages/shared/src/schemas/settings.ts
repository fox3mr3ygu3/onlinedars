/**
 * Platform settings (backend-content): GET/PATCH /admin/settings (ADMIN only) and the
 * non-sensitive subset at GET /settings/public. Each key is stored as one `Setting` row.
 */
import { z } from 'zod';
import { toPatchSchema } from './content-admin';

export const RefundPolicy = {
  /** A refunded payment revokes course access. */
  REVOKE_ACCESS: 'REVOKE_ACCESS',
  /** A refunded payment keeps course access. */
  KEEP_ACCESS: 'KEEP_ACCESS',
} as const;
export type RefundPolicy = (typeof RefundPolicy)[keyof typeof RefundPolicy];

const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(100).default('OnlineDars'),
  tagline: nullableText(300).default(null),
  supportEmail: z.email().max(200).nullable().default(null),
  supportPhone: nullableText(32).default(null),
  telegramUrl: z.url().max(500).nullable().default(null),
  instagramUrl: z.url().max(500).nullable().default(null),
  address: nullableText(500).default(null),
  logoUrl: z.url().max(2048).nullable().default(null),
  /** When true the web shows a maintenance banner. */
  maintenanceMode: z.boolean().default(false),
  /** Unpaid orders expire after this many minutes (used by backend-payments). */
  orderTtlMinutes: z.number().int().min(5).max(7 * 24 * 60).default(60),
  /** What happens to access when a payment is refunded (used by backend-payments). */
  refundPolicy: z.enum(RefundPolicy).default(RefundPolicy.REVOKE_ACCESS),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export type PlatformSettingKey = keyof PlatformSettings;

export const PLATFORM_SETTINGS_DEFAULTS: PlatformSettings = platformSettingsSchema.parse({});

/** PATCH /admin/settings: any subset of keys; unknown keys are rejected. */
export const platformSettingsUpdateSchema = toPatchSchema(platformSettingsSchema.shape).strict();
export type PlatformSettingsUpdate = z.infer<typeof platformSettingsUpdateSchema>;

/** Keys safe to expose without authentication (GET /settings/public). */
export const PUBLIC_SETTING_KEYS = [
  'platformName',
  'tagline',
  'supportEmail',
  'supportPhone',
  'telegramUrl',
  'instagramUrl',
  'address',
  'logoUrl',
  'maintenanceMode',
] as const satisfies readonly PlatformSettingKey[];
export type PublicPlatformSettings = Pick<PlatformSettings, (typeof PUBLIC_SETTING_KEYS)[number]>;
