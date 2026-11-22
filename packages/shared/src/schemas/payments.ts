import { z } from 'zod';
import { PaymentProvider, PaymentStatus } from '../enums';
import { idSchema, paginationQuerySchema } from './common';

/** The client only says which course and provider. Amount/currency always come from the DB. */
export const createOrderSchema = z.object({
  courseId: idSchema,
  provider: z.enum(PaymentProvider),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(PaymentStatus),
  courseId: z.string(),
  amount: z.number().int(),
  currency: z.string(),
});
export type OrderStatusResponse = z.infer<typeof orderStatusResponseSchema>;

/** Admin manual change of a payment/order status; the reason is written to the audit log. */
export const adminPaymentStatusChangeSchema = z.object({
  status: z.enum(PaymentStatus),
  reason: z.string().trim().min(5).max(1000),
});
export type AdminPaymentStatusChange = z.infer<typeof adminPaymentStatusChangeSchema>;

export const paymentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PaymentStatus).optional(),
  provider: z.enum(PaymentProvider).optional(),
  courseId: idSchema.optional(),
  userId: idSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
