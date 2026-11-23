import { PracticeScreen } from '@/features/practice/PracticeScreen';

export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string; practiceId: string }>;
}) {
  const { courseId, lessonId, practiceId } = await params;
  return <PracticeScreen courseId={courseId} lessonId={lessonId} practiceId={practiceId} />;
}
