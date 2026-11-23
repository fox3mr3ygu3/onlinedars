/**
 * vi.fn()-based PrismaService mock for content unit tests. `$transaction(fn)` runs `fn` with the
 * same mock, so assertions can check that writes happened inside the transaction callback.
 */
import { vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';

const METHODS = [
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

const MODELS = [
  'course',
  'module',
  'lesson',
  'lessonMaterial',
  'practice',
  'question',
  'questionOption',
  'direction',
  'teacher',
  'faq',
  'setting',
  'auditLog',
] as const;

type ModelMock = Record<(typeof METHODS)[number], ReturnType<typeof vi.fn>>;
export type PrismaMock = Record<(typeof MODELS)[number], ModelMock> & {
  $transaction: ReturnType<typeof vi.fn>;
  inTransaction: boolean;
};

export function createPrismaMock(): PrismaMock {
  const mock = { inTransaction: false } as PrismaMock;
  for (const model of MODELS) {
    mock[model] = Object.fromEntries(METHODS.map((m) => [m, vi.fn()])) as ModelMock;
  }
  mock.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      mock.inTransaction = true;
      try {
        return await (arg as (tx: PrismaMock) => Promise<unknown>)(mock);
      } finally {
        mock.inTransaction = false;
      }
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
}

export const asPrisma = (m: PrismaMock) => m as unknown as PrismaService;

/** Captures the thrown error of an async call. */
export async function errorOf(
  fn: () => unknown,
): Promise<{ code?: string; getStatus?: () => number; details?: unknown }> {
  try {
    await fn();
  } catch (e) {
    return e as { code?: string; getStatus?: () => number };
  }
  throw new Error('expected an error');
}

/** Recursively collects every object key in a value (to prove answer fields are absent). */
export function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}
