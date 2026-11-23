// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminPayment } from '@/lib/api/admin/types';
import { renderAdmin } from '../test-utils';
import { PaymentStatusDialog, validateStatusChange } from './PaymentStatusDialog';

const payment: AdminPayment = {
  id: 'pay1',
  orderId: 'ord1',
  orderNumber: 1042,
  student: { id: 'u1', fullName: 'Aliyev Vali' },
  course: { id: 'c1', title: 'Python' },
  amount: 49_900_000,
  currency: 'UZS',
  provider: 'PAYME',
  status: 'PAID',
  createdAt: '2026-11-20T10:00:00.000Z',
  paidAt: '2026-11-20T10:01:00.000Z',
};

describe('validateStatusChange', () => {
  it('requires a reason of at least 5 characters', () => {
    expect(validateStatusChange('PAID', { status: 'REFUNDED', reason: '' })).toEqual({
      ok: false,
      problems: ['reasonRequired'],
    });
    expect(validateStatusChange('PAID', { status: 'REFUNDED', reason: '  abc ' })).toMatchObject({
      ok: false,
    });
    expect(
      validateStatusChange('PAID', { status: 'REFUNDED', reason: 'Payme refund #77' }),
    ).toEqual({
      ok: true,
      value: { status: 'REFUNDED', reason: 'Payme refund #77' },
    });
  });

  it('rejects an unchanged status', () => {
    expect(validateStatusChange('PAID', { status: 'PAID', reason: 'some reason' })).toEqual({
      ok: false,
      problems: ['sameStatus'],
    });
  });
});

describe('<PaymentStatusDialog />', () => {
  it('does not submit without a reason and shows the error', async () => {
    const onSubmit = vi.fn();
    renderAdmin(
      <PaymentStatusDialog payment={payment} open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('audit jurnaliga yoziladi');
    // current status is not offered as a target
    expect(screen.queryByRole('option', { name: "To'langan" })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: "Holatni o'zgartirish" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Sababni kiriting (kamida 5 ta belgi)')).toBeInTheDocument();
  });

  it('submits status + trimmed reason and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderAdmin(
      <PaymentStatusDialog
        payment={payment}
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Yangi holat'), 'REFUNDED');
    await userEvent.type(screen.getByLabelText('Sabab'), '  Mijoz talabi bilan qaytarildi ');
    await userEvent.click(screen.getByRole('button', { name: "Holatni o'zgartirish" }));
    expect(onSubmit).toHaveBeenCalledWith('pay1', {
      status: 'REFUNDED',
      reason: 'Mijoz talabi bilan qaytarildi',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the API error (e.g. FORBIDDEN for a content manager) and stays open', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ code: 'FORBIDDEN' });
    const onOpenChange = vi.fn();
    renderAdmin(
      <PaymentStatusDialog
        payment={payment}
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(screen.getByLabelText('Sabab'), 'Tekshiruv natijasi');
    await userEvent.click(screen.getByRole('button', { name: "Holatni o'zgartirish" }));
    expect(await screen.findByText("Sizda bu amal uchun ruxsat yo'q")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
