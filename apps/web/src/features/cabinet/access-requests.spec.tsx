// @vitest-environment jsdom
import type { MyAccessRequest } from '@onlinedars/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AccessRequestsList } from './AccessRequestsList';

const api = vi.hoisted(() => ({ listMyAccessRequests: vi.fn() }));
vi.mock('@/lib/api/access', () => api);

const base: MyAccessRequest = {
  id: 'r1',
  courseId: 'c1',
  courseTitle: 'Python',
  courseSlug: 'python',
  status: 'PENDING',
  hasAccess: false,
  message: null,
  decisionReason: null,
  decidedAt: null,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
};

describe('<AccessRequestsList /> (cabinet)', () => {
  it('shows each request with its status and the next step', async () => {
    api.listMyAccessRequests.mockResolvedValue([
      base,
      {
        ...base,
        id: 'r2',
        courseId: 'c2',
        courseTitle: 'SQL',
        courseSlug: 'sql',
        status: 'APPROVED',
        hasAccess: true,
      },
      {
        ...base,
        id: 'r4',
        courseId: 'c4',
        courseTitle: 'Figma',
        courseSlug: 'figma',
        status: 'APPROVED',
        hasAccess: false,
      },
      {
        ...base,
        id: 'r3',
        courseId: 'c3',
        courseTitle: 'Git',
        courseSlug: 'git',
        status: 'REJECTED',
        decisionReason: "Guruh to'lgan",
        decidedAt: '2026-11-24T12:00:00.000Z',
      },
    ]);
    renderWithProviders(<AccessRequestsList />);
    const pending = await screen.findByTestId('access-request-r1');
    expect(pending).toHaveTextContent('Kutilmoqda');
    expect(screen.getByTestId('access-request-r2')).toHaveTextContent('Tasdiqlangan');
    expect(screen.getByRole('link', { name: 'Kursni ochish' })).toHaveAttribute(
      'href',
      '/cabinet/courses/c2',
    );
    // Approved earlier, revoked later: no "open course" link, the student may ask again.
    const revoked = screen.getByTestId('access-request-r4');
    expect(revoked).toHaveTextContent('Kirish bekor qilingan');
    expect(revoked).toHaveTextContent('Administrator bu kursga kirishni bekor qilgan');
    expect(within(revoked).getByRole('link', { name: "Qayta so'rash" })).toHaveAttribute(
      'href',
      '/courses/figma',
    );
    expect(within(revoked).queryByRole('link', { name: 'Kursni ochish' })).toBeNull();
    const rejected = screen.getByTestId('access-request-r3');
    expect(rejected).toHaveTextContent("Sabab: Guruh to'lgan");
    expect(within(rejected).getByRole('link', { name: "Qayta so'rash" })).toHaveAttribute(
      'href',
      '/courses/git',
    );
  });

  it('empty state points to the catalog', async () => {
    api.listMyAccessRequests.mockResolvedValue([]);
    renderWithProviders(<AccessRequestsList />);
    expect(
      await screen.findByText("Siz hali hech qaysi kursga so'rov yubormagansiz."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kurslar katalogi' })).toHaveAttribute(
      'href',
      '/courses',
    );
  });
});
