import { getRequestConfig } from 'next-intl/server';

/** v1 ships Uzbek (Latin) only, without a locale prefix in URLs. */
export const DEFAULT_LOCALE = 'uz';
export const LOCALES = [DEFAULT_LOCALE] as const;

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
  timeZone: 'Asia/Tashkent',
}));
