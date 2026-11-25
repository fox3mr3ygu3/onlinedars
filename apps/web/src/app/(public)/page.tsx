import { Award, BookOpen, ListChecks, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { CourseGrid } from '@/features/catalog/course-card';
import { DirectionList } from '@/features/catalog/direction-list';
import { Container, EmptyState } from '@/features/catalog/page-section';
import { getCourses, getDirections, orNull } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return { title: { absolute: `OnlineDars — ${t('metaTitle')}` }, alternates: { canonical: '/' } };
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const [courses, directions] = await Promise.all([
    orNull(getCourses({ page: 1, pageSize: 6 })),
    orNull(getDirections()),
  ]);
  const steps = [
    { icon: BookOpen, title: t('step1Title'), text: t('step1Text') },
    { icon: ListChecks, title: t('step2Title'), text: t('step2Text') },
    { icon: Award, title: t('step3Title'), text: t('step3Text') },
  ];

  return (
    <>
      <section className="from-primary/10 via-background to-background border-b bg-gradient-to-b">
        <Container className="flex flex-col items-start gap-6 py-16 sm:py-24">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg">{t('heroSubtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/courses">{t('browseCourses')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">{t('startFree')}</Link>
            </Button>
          </div>
        </Container>
      </section>

      <section aria-labelledby="steps" className="py-12 sm:py-16">
        <Container>
          <h2 id="steps" className="mb-8 text-2xl font-semibold tracking-tight">
            {t('stepsTitle')}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.title} className="bg-card rounded-xl border p-5">
                <s.icon className="text-primary mb-3 size-6" aria-hidden />
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {directions && directions.length > 0 && (
        <section aria-labelledby="directions" className="bg-muted/40 border-y py-12 sm:py-16">
          <Container>
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 id="directions" className="text-2xl font-semibold tracking-tight">
                {t('directionsTitle')}
              </h2>
              <Link href="/directions" className="text-primary text-sm font-medium hover:underline">
                {t('directionsAll')}
              </Link>
            </div>
            <DirectionList directions={directions.slice(0, 6)} compact />
          </Container>
        </section>
      )}

      <section aria-labelledby="courses" className="py-12 sm:py-16">
        <Container>
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 id="courses" className="text-2xl font-semibold tracking-tight">
              {t('coursesTitle')}
            </h2>
            <Link href="/courses" className="text-primary text-sm font-medium hover:underline">
              {t('coursesAll')}
            </Link>
          </div>
          {courses && courses.items.length > 0 ? (
            <CourseGrid courses={courses.items} />
          ) : (
            <EmptyState>{t('coursesEmpty')}</EmptyState>
          )}
        </Container>
      </section>

      <section className="pb-16">
        <Container className="grid gap-4 md:grid-cols-2">
          <div className="bg-primary text-primary-foreground flex flex-col items-start gap-4 rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">{t('ctaTitle')}</h2>
            <p className="opacity-90">{t('ctaText')}</p>
            <Button asChild variant="secondary">
              <Link href="/register">{t('ctaButton')}</Link>
            </Button>
          </div>
          <div className="bg-card flex flex-col items-start gap-4 rounded-2xl border p-6 sm:p-8">
            <ShieldCheck className="text-primary size-7" aria-hidden />
            <h2 className="text-2xl font-semibold">{t('verifyTitle')}</h2>
            <p className="text-muted-foreground">{t('verifyText')}</p>
            <Button asChild variant="outline">
              <Link href="/verify">{t('verifyTitle')}</Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
