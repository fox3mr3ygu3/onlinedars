// @vitest-environment jsdom
import type { MyAccessRequest } from '@onlinedars/shared';
import { screen } from '@testing-library/react';
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
    const rejected = screen.getByTestId('access-request-r3');
    expect(rejected).toHaveTextContent("Sabab: Guruh to'lgan");
    expect(screen.getByRole('link', { name: "Qayta so'rash" })).toHaveAttribute(
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
