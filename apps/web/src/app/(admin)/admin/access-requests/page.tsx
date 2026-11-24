import { Suspense } from 'react';
import { AccessRequestsList } from '@/features/admin/access-requests/AccessRequests';
import { AdminOnly } from '@/features/admin/layout/AdminShell';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminAccessRequestsPage() {
  return (
    <AdminOnly>
      <Suspense>
        <AccessRequestsList />
      </Suspense>
    </AdminOnly>
  );
}
