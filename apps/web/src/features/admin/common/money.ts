import { TIYIN_PER_SOM } from '@onlinedars/shared';

/** The admin types prices in so'm; the API stores and receives integer tiyin. */
export function somToTiyin(som: number | string): number {
  const n = typeof som === 'string' ? Number(som.replace(/\s/g, '').replace(',', '.')) : som;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * TIYIN_PER_SOM);
}

export function tiyinToSom(tiyin: number): number {
  return tiyin / TIYIN_PER_SOM;
}
