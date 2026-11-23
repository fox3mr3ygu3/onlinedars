import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { catalogHref, type CatalogUrlState, pageCount } from './catalog-params';

export function CatalogPagination({
  state,
  total,
  pageSize,
}: {
  state: CatalogUrlState;
  total: number;
  pageSize: number;
}) {
  const t = useTranslations('catalog');
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  const page = Math.min(state.page, pages);

  return (
    <nav aria-label={t('pagination')} className="flex items-center justify-center gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={catalogHref({ ...state, page: page - 1 })} rel="prev">
            <ChevronLeft aria-hidden />
            {t('prev')}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden />
          {t('prev')}
        </Button>
      )}
      <span className="text-muted-foreground text-sm tabular-nums" aria-current="page">
        {t('pageOf', { page, pages })}
      </span>
      {page < pages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={catalogHref({ ...state, page: page + 1 })} rel="next">
            {t('next')}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {t('next')}
          <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
