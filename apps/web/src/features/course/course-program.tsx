import { ChevronDown, PlayCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CourseModuleOutline } from '@/lib/api/public';

/** Program outline: modules as native <details> (no JS needed), lessons inside. */
export function CourseProgram({ modules }: { modules: CourseModuleOutline[] }) {
  const t = useTranslations('course');
  if (modules.length === 0) {
    return <p className="text-muted-foreground">{t('programEmpty')}</p>;
  }
  return (
    <ol className="divide-y rounded-xl border">
      {modules.map((m, i) => (
        <li key={m.id}>
          <details className="group" open={i === 0}>
            <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-start gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
              <span className="bg-primary/10 text-primary mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">
                {t('module', { index: i + 1 })}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{m.title}</span>
                <span className="text-muted-foreground text-sm">
                  {t('moduleLessons', { count: m.lessons.length })}
                </span>
              </span>
              <ChevronDown
                className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-4 pb-4">
              {m.description && (
                <p className="text-muted-foreground mb-3 text-sm">{m.description}</p>
              )}
              <ul className="space-y-2">
                {m.lessons.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <PlayCircle className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{l.title}</span>
                    {l.durationMinutes ? (
                      <span className="text-muted-foreground tabular-nums">
                        {t('minutes', { count: l.durationMinutes })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
