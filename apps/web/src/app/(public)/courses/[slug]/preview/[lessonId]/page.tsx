import { ArrowLeft, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { Button } from '@/components/ui/button';
import { Container, ErrorState } from '@/features/catalog/page-section';
import { LessonMaterial } from '@/features/lesson/LessonMaterials';
import { isApiError } from '@/lib/api/client';
import { getLessonPreview } from '@/lib/api/public';

type Props = { params: Promise<{ slug: string; lessonId: string }> };

/** Deduped per request (metadata + page). Only published `isPreview` lessons exist here. */
const loadPreview = cache(async (slug: string, lessonId: string) => {
  try {
    return { kind: 'ok' as const, preview: await getLessonPreview(slug, lessonId) };
  } catch (e) {
    if (isApiError(e) && e.status === 404) return { kind: 'notFound' as const };
    return { kind: 'error' as const };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const res = await loadPreview(slug, lessonId);
  if (res.kind !== 'ok') {
    const t = await getTranslations('course');
    return { title: t('previewNotFound'), robots: { index: false } };
  }
  const { lesson, course } = res.preview;
  return {
    title: `${lesson.title} — ${course.title}`,
    alternates: { canonical: `/courses/${course.slug}/preview/${lesson.id}` },
  };
}

/** Free preview lesson: anyone can read/watch the materials; practices need enrolment. */
export default async function LessonPreviewPage({ params }: Props) {
  const { slug, lessonId } = await params;
  const t = await getTranslations('course');
  const res = await loadPreview(slug, lessonId);
  if (res.kind === 'notFound') notFound();
  if (res.kind === 'error') {
    return (
      <Container className="py-12">
        <ErrorState>{t('loadError')}</ErrorState>
      </Container>
    );
  }
  const { course, lesson, materials } = res.preview;
  const courseHref = `/courses/${encodeURIComponent(course.slug)}`;

  return (
    <Container className="grid max-w-3xl gap-6 py-8 sm:py-12">
      <Link
        href={courseHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('previewBackToCourse')}
      </Link>
      <header className="space-y-2">
        <p className="text-primary inline-flex items-center gap-1 text-sm font-medium">
          <Eye className="size-4" aria-hidden />
          {t('previewLabel')} · {course.title}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>
        {lesson.summary && <p className="text-muted-foreground">{lesson.summary}</p>}
      </header>
      <section
        className="bg-card space-y-6 rounded-xl border p-4 sm:p-6"
        data-testid="preview-materials"
      >
        {materials.map((m) => (
          <LessonMaterial key={m.id} material={m} />
        ))}
      </section>
      <aside className="bg-primary/5 space-y-3 rounded-xl border p-5" data-testid="preview-cta">
        <h2 className="font-semibold">{t('previewCtaTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('previewCtaText')}</p>
        <Button asChild>
          <Link href={courseHref}>{t('previewCtaButton')}</Link>
        </Button>
      </aside>
    </Container>
  );
}
