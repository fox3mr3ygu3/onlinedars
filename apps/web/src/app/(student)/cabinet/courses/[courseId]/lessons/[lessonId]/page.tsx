import { LessonScreen } from '@/features/lesson/LessonScreen';

export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return <LessonScreen courseId={courseId} lessonId={lessonId} />;
}
