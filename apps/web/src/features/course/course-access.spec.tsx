// @vitest-environment jsdom
import type { CourseAccessState, MyAccessRequest } from '@onlinedars/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { renderWithProviders } from '@/test/render';
import { CourseAccessAction } from './course-access-action';

const session = vi.hoisted(() => ({
  value: { status: 'authenticated', user: { id: 'u1', role: 'STUDENT' } } as {
    status: string;
    user: { id: string; role: string } | null;
  },
}));
const api = vi.hoisted(() => ({
  getCourseAccess: vi.fn(),
  requestCourseAccess: vi.fn(),
}));

vi.mock('@/lib/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth')>()),
  useSession: () => session.value,
}));
vi.mock('@/lib/api/access', () => api);

const request = (over: Partial<MyAccessRequest> = {}): MyAccessRequest => ({
  id: 'r1',
  courseId: 'c1',
  courseTitle: 'Python',
  courseSlug: 'python',
  status: 'PENDING',
  message: null,
  decisionReason: null,
  decidedAt: null,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
  ...over,
});

const render = () => renderWithProviders(<CourseAccessAction courseId="c1" courseSlug="python" />);

beforeEach(() => {
  session.value = { status: 'authenticated', user: { id: 'u1', role: 'STUDENT' } };
  api.getCourseAccess.mockReset();
  api.requestCourseAccess.mockReset();
});

describe('<CourseAccessAction />', () => {
  it('anonymous: links to login and comes back to the course page', () => {
    session.value = { status: 'unauthenticated', user: null };
    render();
    expect(screen.getByRole('link', { name: "Kirish so'rash" })).toHaveAttribute(
      'href',
      '/login?next=%2Fcourses%2Fpython',
    );
    expect(api.getCourseAccess).not.toHaveBeenCalled();
  });

  it('staff: notice instead of a request button', () => {
    session.value = { status: 'authenticated', user: { id: 'a1', role: 'ADMIN' } };
    render();
    expect(screen.getByTestId('staff-enrol-notice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Kirish so'rash" })).toBeNull();
  });

  it('student without a request: sends one and shows it as pending (no price, no payment)', async () => {
    api.getCourseAccess.mockResolvedValue({ enrolled: false, request: null } as CourseAccessState);
    api.requestCourseAccess.mockResolvedValue(request());
    render();
    await userEvent.click(await screen.findByRole('button', { name: "Kirish so'rash" }));
    expect(api.requestCourseAccess).toHaveBeenCalledWith({ courseId: 'c1' });
    expect(await screen.findByTestId('course-access-pending')).toHaveTextContent(
      "So'rov yuborildi",
    );
    expect(screen.queryByText(/so'm|Payme|Click/)).toBeNull();
  });

  it('pending: no button, just the status', async () => {
    api.getCourseAccess.mockResolvedValue({ enrolled: false, request: request() });
    render();
    expect(await screen.findByTestId('course-access-pending')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('rejected: shows the reason and lets the student ask again', async () => {
    api.getCourseAccess.mockResolvedValue({
      enrolled: false,
      request: request({ status: 'REJECTED', decisionReason: "Guruh to'lgan" }),
    });
    render();
    expect(await screen.findByTestId('course-access-rejected')).toHaveTextContent(
      "Sabab: Guruh to'lgan",
    );
    expect(screen.getByRole('button', { name: "Qayta so'rash" })).toBeEnabled();
  });

  it('enrolled: opens the course in the cabinet', async () => {
    api.getCourseAccess.mockResolvedValue({ enrolled: true, request: null });
    render();
    expect(await screen.findByRole('link', { name: 'Kursni ochish' })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1',
    );
  });

  it('a server error is shown and the real state is reloaded', async () => {
    api.getCourseAccess.mockResolvedValue({ enrolled: false, request: null });
    api.requestCourseAccess.mockRejectedValue(
      new ApiError(409, 'ACCESS_REQUEST_PENDING', 'pending'),
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: "Kirish so'rash" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("So'rovingiz allaqachon yuborilgan");
    await waitFor(() => expect(api.getCourseAccess).toHaveBeenCalledTimes(2));
  });
});
