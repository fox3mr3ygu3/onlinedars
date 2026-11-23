import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { StudentsList } from '@/features/admin/students/Students';

/** ADMIN only (the API enforces it; this hides the page for content managers). */
export default function AdminStudentsPage() {
  return (
    <AdminOnly>
      <StudentsList />
    </AdminOnly>
  );
}
