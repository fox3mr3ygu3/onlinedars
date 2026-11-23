import { LessonEditor } from '@/features/admin/lessons/LessonEditor';

export default async function AdminLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonEditor lessonId={id} />;
}
