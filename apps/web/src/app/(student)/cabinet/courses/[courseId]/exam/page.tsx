import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ExamScreen } from '@/features/exam/ExamScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('exam');
  return { title: t('title') };
}

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <ExamScreen courseId={courseId} />;
}
