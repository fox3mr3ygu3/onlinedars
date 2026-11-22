import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container, EmptyState, ErrorState, PageHeader } from '@/features/catalog/page-section';
import { getFaq, orNull } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faq');
  return { title: t('title'), description: t('metaDescription'), alternates: { canonical: '/faq' } };
}

export default async function FaqPage() {
  const t = await getTranslations('faq');
  const items = await orNull(getFaq());
  const jsonLd =
    items && items.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Container className="max-w-3xl py-8">
        {!items ? (
          <ErrorState>{t('loadError')}</ErrorState>
        ) : items.length === 0 ? (
          <EmptyState>{t('empty')}</EmptyState>
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map((f) => (
              <li key={f.id}>
                <details className="group">
                  <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-3 px-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.question}</span>
                    <ChevronDown
                      className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="text-muted-foreground whitespace-pre-line px-4 pb-4 text-sm leading-relaxed">
                    {f.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
