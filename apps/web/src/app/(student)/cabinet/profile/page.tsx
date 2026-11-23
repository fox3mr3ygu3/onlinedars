import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileScreen } from '@/features/profile/ProfileScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('profile.title') };
}

export default function Page() {
  return <ProfileScreen />;
}
