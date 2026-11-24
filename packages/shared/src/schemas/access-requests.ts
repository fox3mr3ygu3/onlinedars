/**
 * Course access requests: a student asks for a course, an admin approves (grants access) or
 * rejects. Courses are never bought or self-enrolled; access comes only from an admin.
 */
import { z } from 'zod';
import { AccessRequestStatus } from '../enums';
import { idSchema, paginated, paginationQuerySchema } from './common';

/** POST /access-requests body (students only). */
export const createAccessRequestSchema = z.object({
  courseId: idSchema,
  message: z.string().trim().max(1000).optional(),
});
export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;

/** The student's own view of a request (course page, GET /me/access-requests). */
export const myAccessRequestSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  status: z.enum(AccessRequestStatus),
  message: z.string().nullable(),
  /** Admin's reason when rejected. */
  decisionReason: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MyAccessRequest = z.infer<typeof myAccessRequestSchema>;
export const myAccessRequestListSchema = z.array(myAccessRequestSchema);

/** GET /me/course-access/:courseId: what the course page shows a signed-in student. */
export const courseAccessStateSchema = z.object({
  enrolled: z.boolean(),
  request: myAccessRequestSchema.nullable(),
});
export type CourseAccessState = z.infer<typeof courseAccessStateSchema>;

export const adminAccessRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(AccessRequestStatus).optional(),
  courseId: idSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type AdminAccessRequestsQuery = z.infer<typeof adminAccessRequestsQuerySchema>;

export const adminAccessRequestSchema = myAccessRequestSchema.extend({
  student: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  decidedBy: z.object({ id: z.string(), fullName: z.string() }).nullable(),
});
export type AdminAccessRequest = z.infer<typeof adminAccessRequestSchema>;
export const adminAccessRequestListSchema = paginated(adminAccessRequestSchema).extend({
  pendingCount: z.number().int(),
});
export type AdminAccessRequestList = z.infer<typeof adminAccessRequestListSchema>;

/** POST /admin/access-requests/:id/reject body. The reason is shown to the student. */
export const rejectAccessRequestSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});
export type RejectAccessRequestInput = z.infer<typeof rejectAccessRequestSchema>;
