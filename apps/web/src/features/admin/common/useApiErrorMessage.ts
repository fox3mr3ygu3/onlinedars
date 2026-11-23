'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from '@/lib/api/client';

/** Maps an API error `{code}` to `errors.<code>` from uz.json (falls back to INTERNAL_ERROR). */
export function useApiErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (e: unknown): string => {
      const code = e instanceof ApiError ? e.code : (e as { code?: string } | null)?.code;
      if (code && t.has(code)) return t(code);
      return t('INTERNAL_ERROR');
    },
    [t],
  );
}

/**
 * Translates a zod message key (e.g. "validation.slug") from the root namespace.
 * Messages that aren't keys (zod's built-in English texts) become a generic admin message.
 */
export function useValidationMessage() {
  const t = useTranslations();
  return useCallback(
    (message: string | undefined): string | undefined => {
      if (!message) return undefined;
      if (t.has(message)) return t(message);
      return t('admin.common.invalid');
    },
    [t],
  );
}
