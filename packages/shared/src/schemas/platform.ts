import { z } from 'zod';
import { NotificationType } from '../enums';
import { idSchema, paginated, paginationQuerySchema } from './common';

// ── audit log ──

export const auditLogQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: idSchema.optional(),
  actorId: idSchema.optional(),
  action: z.string().trim().min(1).max(64).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  actor: z.object({ id: z.string(), fullName: z.string(), role: z.string() }).nullable(),
});
export type AuditLogView = z.infer<typeof auditLogSchema>;
export const auditLogListSchema = paginated(auditLogSchema);

// ── in-app notifications ──

export const notificationQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NotificationType),
  /** Uzbek fallback text; the web may render its own i18n text from `type` + `data`. */
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationView = z.infer<typeof notificationSchema>;
export const notificationListSchema = paginated(notificationSchema).extend({
  unreadCount: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;
