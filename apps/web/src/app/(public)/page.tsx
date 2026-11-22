import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

/** Placeholder landing page (frontend-public replaces it). */
export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t('heroTitle')}</h1>
      <p className="text-muted-foreground max-w-2xl text-lg">{t('heroSubtitle')}</p>
      <Button asChild size="lg">
        <Link href="/courses">{t('browseCourses')}</Link>
      </Button>
    </main>
  );
}
