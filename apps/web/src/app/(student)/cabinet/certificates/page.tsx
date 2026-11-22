import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CertificatesList } from '@/features/cabinet/CertificatesList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('certificates.title') };
}

export default function Page() {
  return <CertificatesList />;
}
