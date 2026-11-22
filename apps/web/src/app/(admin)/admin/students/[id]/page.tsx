import { AdminOnly } from '@/features/admin/layout/AdminShell';
import { StudentDetail } from '@/features/admin/students/Students';

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminOnly>
      <StudentDetail studentId={id} />
    </AdminOnly>
  );
}
