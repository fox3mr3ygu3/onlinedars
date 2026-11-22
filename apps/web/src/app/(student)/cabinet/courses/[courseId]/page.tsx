import { CourseTreeScreen } from '@/features/lesson/CourseTree';

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseTreeScreen courseId={courseId} />;
}
