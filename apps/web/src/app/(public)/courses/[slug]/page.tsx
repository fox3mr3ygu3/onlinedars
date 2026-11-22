import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Container, ErrorState } from '@/features/catalog/page-section';
import { excerpt } from '@/features/catalog/seo';
import { CourseProgram } from '@/features/course/course-program';
import { CourseGoals, CoursePurchaseCard } from '@/features/course/course-purchase-card';
import { loadCourse } from '@/features/course/load-course';
import { TeacherAvatar } from '@/features/course/teacher-avatar';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadCourse(slug);
  if (res.kind !== 'ok') {
    const t = await getTranslations('course');
    return { title: t('notFound'), robots: { index: false } };
  }
  const { course } = res;
  const description = excerpt(course.shortDescription || course.description);
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      title: course.title,
      description,
      url: `/courses/${course.slug}`,
      images: course.coverImageUrl ? [{ url: course.coverImageUrl }] : undefined,
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('course');
  const tc = await getTranslations('catalog');
  const res = await loadCourse(slug);
  if (res.kind === 'notFound') notFound();
  if (res.kind === 'error') {
    return (
      <Container className="py-12">
        <ErrorState>{t('loadError')}</ErrorState>
      </Container>
    );
  }
  const { course } = res;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: excerpt(course.shortDescription || course.description, 300),
    provider: { '@type': 'Organization', name: 'OnlineDars' },
    inLanguage: 'uz',
    offers: {
      '@type': 'Offer',
      price: course.isFree ? 0 : Math.round(course.price / 100),
      priceCurrency: 'UZS',
      category: course.isFree ? 'Free' : 'Paid',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with `<` escaped cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="bg-muted/40 border-b">
        <Container className="py-8 sm:py-12">
          <nav aria-label="breadcrumb" className="text-muted-foreground mb-4 text-sm">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/courses" className="hover:text-foreground">
                  {t('breadcrumbCourses')}
                </Link>
              </li>
              {course.direction && (
                <li className="flex items-center gap-1">
                  <ChevronRight className="size-3.5" aria-hidden />
                  <Link
                    href={`/courses?directionId=${encodeURIComponent(course.direction.id)}`}
                    className="hover:text-foreground"
                  >
                    {course.direction.name}
                  </Link>
                </li>
              )}
            </ol>
          </nav>
          <h1 className="max-w-3xl text-2xl font-bold tracking-tight sm:text-4xl">
            {course.title}
          </h1>
          {course.shortDescription && (
            <p className="text-muted-foreground mt-3 max-w-3xl text-lg">{course.shortDescription}</p>
          )}
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">{t('level')}: </span>
            <span className="font-medium">{tc(`level_${course.level}`)}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{tc('lessons', { count: course.lessonCount })}</span>
          </p>
        </Container>
      </div>

      <Container className="grid gap-8 py-8 lg:grid-cols-[1fr_340px] lg:py-12">
        <div className="order-2 min-w-0 space-y-10 lg:order-1">
          {course.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="mb-3 text-xl font-semibold">
                {t('about')}
              </h2>
              <div className="text-foreground/90 whitespace-pre-line leading-relaxed">
                {course.description}
              </div>
            </section>
          )}
          {course.goals.length > 0 && (
            <section aria-labelledby="goals">
              <h2 id="goals" className="mb-4 text-xl font-semibold">
                {t('goals')}
              </h2>
              <CourseGoals goals={course.goals} />
            </section>
          )}
          <section aria-labelledby="program">
            <h2 id="program" className="mb-4 text-xl font-semibold">
              {t('program')}
            </h2>
            <CourseProgram modules={course.modules} />
          </section>
          {course.teachers.length > 0 && (
            <section aria-labelledby="teachers">
              <h2 id="teachers" className="mb-4 text-xl font-semibold">
                {t('teachers')}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {course.teachers.map((tch) => (
                  <li key={tch.id} className="flex items-center gap-3 rounded-xl border p-4">
                    <TeacherAvatar name={tch.fullName} photoUrl={tch.photoUrl} />
                    <div>
                      <p className="font-medium">{tch.fullName}</p>
                      {tch.title && <p className="text-muted-foreground text-sm">{tch.title}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="order-1 lg:order-2">
          <CoursePurchaseCard course={course} />
        </div>
      </Container>
    </>
  );
}
