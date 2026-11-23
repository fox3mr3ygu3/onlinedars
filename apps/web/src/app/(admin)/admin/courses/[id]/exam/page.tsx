import { ExamEditor } from '@/features/admin/exams/ExamEditor';

export default async function AdminCourseExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamEditor courseId={id} />;
}
