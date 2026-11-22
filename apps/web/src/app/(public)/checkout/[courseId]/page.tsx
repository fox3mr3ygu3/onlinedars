import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Price } from '@/features/catalog/price';
import { Container, ErrorState, PageHeader } from '@/features/catalog/page-section';
import { CheckoutForm } from '@/features/checkout/checkout-form';
import { loadCourse } from '@/features/course/load-course';

type Props = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ course?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Order summary + provider choice. The course is loaded by slug when the course page passed one
 * (`?course=<slug>`), otherwise by id. Middleware already requires a signed-in user here.
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const t = await getTranslations('checkout');
  const tc = await getTranslations('catalog');
  const { courseId } = await params;
  const slugParam = (await searchParams).course;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const res = await loadCourse(slug || courseId);
  if (res.kind === 'notFound') notFound();

  return (
    <>
      <PageHeader title={t('title')} />
      <Container className="max-w-3xl py-8">
        {res.kind === 'error' ? (
          <ErrorState>{tc('loadError')}</ErrorState>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <section aria-labelledby="summary" className="bg-card rounded-xl border p-5 shadow-sm">
              <h2 id="summary" className="mb-4 font-semibold">
                {t('summary')}
              </h2>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('course')}</dt>
                  <dd className="font-medium" data-testid="checkout-course-title">
                    {res.course.title}
                  </dd>
                  <dd className="text-muted-foreground">
                    {t('lessons', { count: res.course.lessonCount })}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-medium">{t('total')}</dt>
                  <dd>
                    <Price
                      isFree={res.course.isFree}
                      price={res.course.price}
                      className="text-lg"
                    />
                  </dd>
                </div>
              </dl>
              <Link
                href={`/courses/${res.course.slug}`}
                className="text-primary mt-4 inline-block text-sm hover:underline"
              >
                {t('backToCourse')}
              </Link>
            </section>
            <section>
              <CheckoutForm
                courseId={res.course.id}
                isFree={res.course.isFree || res.course.price === 0}
              />
            </section>
          </div>
        )}
      </Container>
    </>
  );
}
