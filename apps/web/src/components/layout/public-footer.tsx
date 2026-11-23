import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function PublicFooter() {
  const t = await getTranslations('publicLayout');
  const groups = [
    {
      title: t('footerLearn'),
      links: [
        { href: '/courses', label: t('courses') },
        { href: '/directions', label: t('directions') },
        { href: '/teachers', label: t('teachers') },
      ],
    },
    {
      title: t('footerHelp'),
      links: [
        { href: '/faq', label: t('faq') },
        { href: '/verify', label: t('verify') },
      ],
    },
    {
      title: t('footerAccount'),
      links: [
        { href: '/login', label: t('login') },
        { href: '/register', label: t('register') },
        { href: '/cabinet', label: t('cabinet') },
      ],
    },
  ];

  return (
    <footer className="bg-muted/40 mt-auto border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            {t('brand')}
          </Link>
          <p className="text-muted-foreground text-sm">{t('footerTagline')}</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="mb-3 text-sm font-semibold">{g.title}</h2>
            <ul className="space-y-2 text-sm">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground border-t py-4 text-center text-xs">
        {t('copyright', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
