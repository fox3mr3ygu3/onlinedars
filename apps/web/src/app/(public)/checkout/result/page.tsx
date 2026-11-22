import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container, PageHeader } from '@/features/catalog/page-section';
import { CheckoutResult } from '@/features/checkout/checkout-result';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('resultTitle'), robots: { index: false, follow: false } };
}

/** `/checkout/result?orderId=…` — provider return URL. Status comes only from polling the API. */
export default async function CheckoutResultPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string | string[] }>;
}) {
  const t = await getTranslations('checkout');
  const raw = (await searchParams).orderId;
  const orderId = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 64) || null;
  return (
    <>
      <PageHeader title={t('resultTitle')} />
      <Container className="max-w-xl py-8">
        <CheckoutResult orderId={orderId} />
      </Container>
    </>
  );
}
