import { ErrorCode } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import messages from '../../messages/uz.json';
import { cn, formatSom } from './utils';

describe('uz.json', () => {
  it('has a message for every API error code', () => {
    const errors = messages.errors as Record<string, string>;
    const missing = Object.values(ErrorCode).filter((code) => !errors[code]);
    expect(missing).toEqual([]);
  });
});

describe('utils', () => {
  it('merges tailwind classes', () => {
    expect(cn('px-2', 'px-4', undefined)).toBe('px-4');
  });

  it('formats tiyin as som with thousands separators', () => {
    expect(formatSom(125_000_000)).toBe('1 250 000');
    expect(formatSom(0)).toBe('0');
  });
});
