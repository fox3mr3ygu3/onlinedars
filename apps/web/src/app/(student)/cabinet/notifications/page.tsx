import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotificationsList } from '@/features/cabinet/NotificationsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('notifications.title') };
}

export default function Page() {
  return <NotificationsList />;
}
