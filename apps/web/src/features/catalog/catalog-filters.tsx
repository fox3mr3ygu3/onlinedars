'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DirectionSummary } from '@/lib/api/public';
import type { CatalogUrlState } from './catalog-params';

const selectClass =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

/**
 * Plain GET form (works without JS); selects submit on change. Changing any filter resets the page
 * because `page` is not part of the form.
 */
export function CatalogFilters({
  state,
  directions,
}: {
  state: CatalogUrlState;
  directions: DirectionSummary[];
}) {
  const t = useTranslations('catalog');
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  const hasFilters = !!(state.search || state.directionId || state.price);

  return (
    <form
      action="/courses"
      method="get"
      role="search"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_160px_auto]"
    >
      <div className="relative sm:col-span-2 lg:col-span-1">
        <label htmlFor="catalog-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="catalog-search"
          name="search"
          type="search"
          defaultValue={state.search}
          placeholder={t('searchPlaceholder')}
          maxLength={100}
          className="pl-9"
        />
      </div>
      <div>
        <label htmlFor="catalog-direction" className="sr-only">
          {t('direction')}
        </label>
        <select
          id="catalog-direction"
          name="directionId"
          defaultValue={state.directionId}
          onChange={submitOnChange}
          className={selectClass}
        >
          <option value="">{t('allDirections')}</option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="catalog-price" className="sr-only">
          {t('price')}
        </label>
        <select
          id="catalog-price"
          name="price"
          defaultValue={state.price}
          onChange={submitOnChange}
          className={selectClass}
        >
          <option value="">{t('priceAll')}</option>
          <option value="free">{t('priceFree')}</option>
          <option value="paid">{t('pricePaid')}</option>
        </select>
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" className="flex-1 lg:flex-none">
          {t('searchButton')}
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/courses">{t('reset')}</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
