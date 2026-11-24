import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccessRequestsList } from '@/features/cabinet/AccessRequestsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('cabinet.requests.title') };
}

export default function Page() {
  return <AccessRequestsList />;
}
