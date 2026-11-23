import { LessonPracticesPage } from '@/features/admin/lessons/LessonEditor';

export default async function AdminLessonPracticesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LessonPracticesPage lessonId={id} />;
}
