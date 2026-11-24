/**
 * Typed client for the student's own account data: profile (`/users/me`, `/auth/me`),
 * and in-app notifications (`/me/notifications`).
 */
import type {
  AuthUser,
  ChangePasswordInput,
  NotificationType,
  Paginated,
  UpdateProfileInput,
} from '@onlinedars/shared';
import { studentFetch, toQuery } from './student-fetch';

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

  notifications: (q: NotificationsQuery = {}) =>
    studentFetch<MyNotificationList>(
      `/me/notifications${toQuery({ ...q, unreadOnly: q.unreadOnly ? 'true' : undefined })}`,
    ),
  markNotificationRead: (id: string) =>
    studentFetch<MyNotification>(`/me/notifications/${enc(id)}/read`, { method: 'POST' }),
};
