import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MyCourses } from '@/features/cabinet/MyCourses';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('cabinet.courses.title') };
}

export default function Page() {
  return <MyCourses />;
}
