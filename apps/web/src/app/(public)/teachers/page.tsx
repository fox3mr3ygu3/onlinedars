import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container, EmptyState, ErrorState, PageHeader } from '@/features/catalog/page-section';
import { TeacherAvatar } from '@/features/course/teacher-avatar';
import { getTeachers, orNull } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers');
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: { canonical: '/teachers' },
  };
}

export default async function TeachersPage() {
  const t = await getTranslations('teachers');
  const teachers = await orNull(getTeachers());
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Container className="py-8">
        {!teachers ? (
          <ErrorState>{t('loadError')}</ErrorState>
        ) : teachers.length === 0 ? (
          <EmptyState>{t('empty')}</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((tch) => (
              <li
                key={tch.id}
                id={tch.slug}
                className="bg-card flex flex-col gap-4 rounded-xl border p-5"
              >
                <div className="flex items-center gap-4">
                  <TeacherAvatar name={tch.fullName} photoUrl={tch.photoUrl} className="size-16" />
                  <div>
                    <h2 className="font-semibold">{tch.fullName}</h2>
                    {tch.title && <p className="text-muted-foreground text-sm">{tch.title}</p>}
                  </div>
                </div>
                {tch.bio && (
                  <p className="text-muted-foreground line-clamp-6 whitespace-pre-line text-sm">
                    {tch.bio}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
