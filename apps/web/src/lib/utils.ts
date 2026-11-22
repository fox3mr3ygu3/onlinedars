import { TIYIN_PER_SOM } from '@onlinedars/shared';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formats an amount stored in tiyin as "1 250 000 so'm" (the suffix comes from i18n). */
export function formatSom(tiyin: number): string {
  const som = Math.round(tiyin / TIYIN_PER_SOM);
  return som.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
