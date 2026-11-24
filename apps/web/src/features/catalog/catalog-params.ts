import type { CatalogParams } from '@/lib/api/public';

/** URL state of /courses (`?search=&directionId=&page=`). */
export interface CatalogUrlState {
  search: string;
  directionId: string;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

export function parseCatalogParams(raw: RawParams): CatalogUrlState {
  const page = Number.parseInt(first(raw.page), 10);
  return {
    search: first(raw.search).slice(0, 100),
    directionId: first(raw.directionId).slice(0, 64),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function toApiParams(s: CatalogUrlState, pageSize: number): CatalogParams {
  return {
    search: s.search || undefined,
    directionId: s.directionId || undefined,
    page: s.page,
    pageSize,
  };
}

/** Builds a /courses URL, dropping empty values and page 1. */
export function catalogHref(s: Partial<CatalogUrlState>): string {
  const sp = new URLSearchParams();
  if (s.search) sp.set('search', s.search);
  if (s.directionId) sp.set('directionId', s.directionId);
  if (s.page && s.page > 1) sp.set('page', String(s.page));
  const q = sp.toString();
  return q ? `/courses?${q}` : '/courses';
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}
