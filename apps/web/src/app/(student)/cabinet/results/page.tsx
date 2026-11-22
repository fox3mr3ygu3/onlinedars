import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ResultsList } from '@/features/cabinet/ResultsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('results.title') };
}

export default function Page() {
  return <ResultsList />;
}
