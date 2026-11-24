import { CoursePlayer } from '@/features/lesson/CoursePlayer';

export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return <CoursePlayer courseId={courseId} lessonId={lessonId} />;
}
