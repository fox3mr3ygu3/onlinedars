import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PaymentsList } from '@/features/cabinet/PaymentsList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('payments.title') };
}

export default function Page() {
  return <PaymentsList />;
}
