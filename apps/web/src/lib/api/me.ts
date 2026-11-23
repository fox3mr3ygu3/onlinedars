/**
 * Typed client for the student's own account data: profile (`/users/me`, `/auth/me`),
 * payment history (`/me/orders`) and in-app notifications (`/me/notifications`).
 */
import type {
  AuthUser,
  ChangePasswordInput,
  NotificationType,
  Paginated,
  PaymentProvider,
  PaymentStatus,
  UpdateProfileInput,
} from '@onlinedars/shared';
import { studentFetch, toQuery } from './student-fetch';

/**
 * Item of GET /me/orders. TODO(merge): backend-payments exports `OrderView` from
 * `@onlinedars/shared` (schemas/payments.ts); switch to it once merged. Amounts in tiyin.
 */
export interface MyOrder {
  orderId: string;
  number: number;
  status: PaymentStatus;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  amount: number;
  currency: string;
  provider: PaymentProvider | null;
  enrolled: boolean;
  paidAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** TODO(merge): `NotificationView` / `NotificationList` from `@onlinedars/shared`. */
export interface MyNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface MyNotificationList extends Paginated<MyNotification> {
  unreadCount: number;
}

export interface OrdersQuery {
  page?: number;
  pageSize?: number;
  status?: PaymentStatus;
}

export interface NotificationsQuery {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

const enc = encodeURIComponent;

export const meApi = {
  /** Current user (auth). */
  authMe: () => studentFetch<AuthUser>('/auth/me'),
  profile: () => studentFetch<AuthUser>('/users/me'),
  updateProfile: (input: UpdateProfileInput) =>
    studentFetch<AuthUser>('/users/me', { method: 'PATCH', body: input }),
  changePassword: (input: ChangePasswordInput) =>
    studentFetch<void>('/users/me/password', { method: 'POST', body: input }),

  orders: (q: OrdersQuery = {}) =>
    studentFetch<Paginated<MyOrder>>(`/me/orders${toQuery({ ...q })}`),

  notifications: (q: NotificationsQuery = {}) =>
    studentFetch<MyNotificationList>(
      `/me/notifications${toQuery({ ...q, unreadOnly: q.unreadOnly ? 'true' : undefined })}`,
    ),
  markNotificationRead: (id: string) =>
    studentFetch<MyNotification>(`/me/notifications/${enc(id)}/read`, { method: 'POST' }),
};
