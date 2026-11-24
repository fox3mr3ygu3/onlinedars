// @vitest-environment jsdom
import type { AdminAccessRequest, AdminAccessRequestList } from '@onlinedars/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAdmin } from '../test-utils';
import { AccessRequestsList, validateRejectReason } from './AccessRequests';

const api = vi.hoisted(() => ({
  listAccessRequests: vi.fn(),
  approveAccessRequest: vi.fn(),
  rejectAccessRequest: vi.fn(),
}));
vi.mock('@/lib/api/admin/management', () => api);
vi.mock('@/lib/api/admin/content', () => ({
  listCourses: vi.fn(async () => ({ items: [{ id: 'c1', title: 'Python' }], total: 1 })),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (over: Partial<AdminAccessRequest> = {}): AdminAccessRequest => ({
  id: 'r1',
  courseId: 'c1',
  courseTitle: 'Python',
  courseSlug: 'python',
  status: 'PENDING',
  hasAccess: false,
  message: 'Iltimos',
  decisionReason: null,
  decidedAt: null,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
  student: { id: 'u1', fullName: 'Ali Valiyev', email: 'ali@x.uz', phone: '+998901234567' },
  decidedBy: null,
  ...over,
});
const list = (items: AdminAccessRequest[]): AdminAccessRequestList => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  pendingCount: items.filter((i) => i.status === 'PENDING').length,
});

beforeEach(() => {
  api.listAccessRequests.mockReset().mockResolvedValue(list([row()]));
  api.approveAccessRequest.mockReset().mockResolvedValue(row({ status: 'APPROVED' }));
  api.rejectAccessRequest.mockReset().mockResolvedValue(row({ status: 'REJECTED' }));
});

describe('validateRejectReason', () => {
  it('needs at least 3 characters and trims', () => {
    expect(validateRejectReason('')).toBeNull();
    expect(validateRejectReason('  ab ')).toBeNull();
    expect(validateRejectReason("  Guruh to'lgan ")).toBe("Guruh to'lgan");
  });
});

describe('<AccessRequestsList />', () => {
  it('opens on the pending queue and shows the student, course and note', async () => {
    renderAdmin(<AccessRequestsList />);
    const tr = await screen.findByTestId('access-request-r1');
    expect(tr).toHaveTextContent('Ali Valiyev');
    expect(tr).toHaveTextContent('Python');
    expect(tr).toHaveTextContent('«Iltimos»');
    expect(api.listAccessRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', page: 1 }),
    );
    expect(screen.getByTestId('pending-count')).toHaveTextContent("1 ta so'rov kutilmoqda");
  });

  it('approve calls the API and reloads the queue', async () => {
    renderAdmin(<AccessRequestsList />);
    const tr = await screen.findByTestId('access-request-r1');
    await userEvent.click(within(tr).getByRole('button', { name: 'Tasdiqlash' }));
    expect(api.approveAccessRequest).toHaveBeenCalledWith('r1');
    await waitFor(() => expect(api.listAccessRequests).toHaveBeenCalledTimes(2));
  });

  it('reject needs a reason, then sends it trimmed', async () => {
    renderAdmin(<AccessRequestsList />);
    const tr = await screen.findByTestId('access-request-r1');
    await userEvent.click(within(tr).getByRole('button', { name: 'Rad etish' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('«Python» kursiga Ali Valiyev');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rad etish' }));
    expect(api.rejectAccessRequest).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Sababni kiriting (kamida 3 ta belgi)')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Sabab'), "  Guruh to'lgan ");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rad etish' }));
    expect(api.rejectAccessRequest).toHaveBeenCalledWith('r1', "Guruh to'lgan");
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('an approved request whose access was revoked shows "Kirish bekor qilingan"', async () => {
    api.listAccessRequests.mockResolvedValue(
      list([row({ status: 'APPROVED', hasAccess: false, decidedAt: '2026-11-24T11:00:00.000Z' })]),
    );
    renderAdmin(<AccessRequestsList />);
    const tr = await screen.findByTestId('access-request-r1');
    expect(tr).toHaveTextContent('Kirish bekor qilingan');
  });

  it('decided requests show who decided and no buttons', async () => {
    api.listAccessRequests.mockResolvedValue(
      list([
        row({
          status: 'REJECTED',
          decisionReason: "Guruh to'lgan",
          decidedAt: '2026-11-24T11:00:00.000Z',
          decidedBy: { id: 'a1', fullName: 'Admin' },
        }),
      ]),
    );
    renderAdmin(<AccessRequestsList />);
    const tr = await screen.findByTestId('access-request-r1');
    expect(tr).toHaveTextContent('Admin, 24.11.2026 16:00');
    expect(tr).toHaveTextContent("Guruh to'lgan");
    expect(within(tr).queryByRole('button')).toBeNull();
  });
});
