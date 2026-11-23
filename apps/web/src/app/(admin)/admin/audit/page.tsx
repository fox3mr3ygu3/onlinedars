import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { AuditLog } from '@/features/admin/audit/AuditLog';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminAuditPage() {
  return (
    <AdminOnly>
      <AuditLog />
    </AdminOnly>
  );
}
