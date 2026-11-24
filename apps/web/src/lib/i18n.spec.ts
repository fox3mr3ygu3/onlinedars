import { ErrorCode } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import messages from '../../messages/uz.json';
import { cn } from './utils';

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
});
