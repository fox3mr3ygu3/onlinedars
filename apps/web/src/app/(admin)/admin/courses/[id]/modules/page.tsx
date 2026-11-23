import { ProgramEditor } from '@/features/admin/courses/ProgramEditor';

export default async function AdminCourseModulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgramEditor courseId={id} />;
}
