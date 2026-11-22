import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { PaymentsList } from '@/features/admin/payments/PaymentsList';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminPaymentsPage() {
  return (
    <AdminOnly>
      <PaymentsList />
    </AdminOnly>
  );
}
