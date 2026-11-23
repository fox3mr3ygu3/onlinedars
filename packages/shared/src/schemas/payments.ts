import { z } from 'zod';
import { NotificationType, PaymentProvider, PaymentStatus } from '../enums';
import { idSchema, paginated, paginationQuerySchema } from './common';

/** The client only says which course and provider. Amount/currency always come from the DB. */
export const createOrderSchema = z.object({
  courseId: idSchema,
  provider: z.enum(PaymentProvider),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * POST /orders response. Paid course: an order + provider redirect URL.
 * Free course: no order is created, the student is enrolled directly.
 */
export const createOrderResponseSchema = z.union([
  z.object({
    enrolled: z.literal(false),
    orderId: z.string(),
    number: z.number().int(),
    amount: z.number().int(),
    currency: z.string(),
    provider: z.enum(PaymentProvider),
    status: z.enum(PaymentStatus),
    redirectUrl: z.string(),
  }),
  z.object({
    enrolled: z.literal(true),
    courseId: z.string(),
  }),
]);
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export const orderStatusResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(PaymentStatus),
  courseId: z.string(),
  amount: z.number().int(),
  currency: z.string(),
});
export type OrderStatusResponse = z.infer<typeof orderStatusResponseSchema>;

/** GET /orders/:orderId and items of GET /me/orders. Amounts in tiyin. */
export const orderSchema = orderStatusResponseSchema.extend({
  number: z.number().int(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  provider: z.enum(PaymentProvider).nullable(),
  /** True when the student currently has access to the course. */
  enrolled: z.boolean(),
  paidAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type OrderView = z.infer<typeof orderSchema>;
export const orderListSchema = paginated(orderSchema);

export const myOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PaymentStatus).optional(),
});
export type MyOrdersQuery = z.infer<typeof myOrdersQuerySchema>;

/** Admin manual change of an order status; the reason is written to the audit log. */
export const adminPaymentStatusChangeSchema = z.object({
  status: z.enum(PaymentStatus),
  reason: z.string().trim().min(5).max(1000),
});
export type AdminPaymentStatusChange = z.infer<typeof adminPaymentStatusChangeSchema>;

/**
 * GET /admin/payments filters. `search` matches the order number, order id, or the student's
 * name / email / phone. Amounts in tiyin.
 */
export const paymentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PaymentStatus).optional(),
  provider: z.enum(PaymentProvider).optional(),
  courseId: idSchema.optional(),
  userId: idSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const providerTransactionSchema = z.object({
  id: z.string(),
  provider: z.enum(PaymentProvider),
  providerTransactionId: z.string(),
  amount: z.number().int(),
  status: z.enum(PaymentStatus),
  performedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.number().int().nullable(),
  createdAt: z.string(),
});
export type ProviderTransactionView = z.infer<typeof providerTransactionSchema>;

/** Item of GET /admin/payments (one row per order, with its provider transactions). */
export const adminPaymentSchema = orderSchema.extend({
  student: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  transactions: z.array(providerTransactionSchema),
});
export type AdminPaymentView = z.infer<typeof adminPaymentSchema>;
export const adminPaymentListSchema = paginated(adminPaymentSchema);

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

/**
 * What happens to access after a refund. The admin edits it as the `refundPolicy` platform
 * setting (values `REVOKE_ACCESS` / `KEEP_ACCESS`, see ./settings); payments normalises it to
 * `revoke` / `keep`. Legacy lowercase values are still accepted.
 */
export const REFUND_POLICY_SETTING_KEY = 'refundPolicy';
export const PaymentRefundPolicy = { REVOKE: 'revoke', KEEP: 'keep' } as const;
export type PaymentRefundPolicy = (typeof PaymentRefundPolicy)[keyof typeof PaymentRefundPolicy];
export const paymentRefundPolicySchema = z.preprocess(
  (v) => (v === 'REVOKE_ACCESS' ? 'revoke' : v === 'KEEP_ACCESS' ? 'keep' : v),
  z.enum(PaymentRefundPolicy),
);
