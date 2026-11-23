import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { Reports } from '@/features/admin/reports/Reports';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminReportsPage() {
  return (
    <AdminOnly>
      <Reports />
    </AdminOnly>
  );
}
