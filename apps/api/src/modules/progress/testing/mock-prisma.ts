/**
 * Auto-mocking PrismaService for backend-learning unit tests: every `prisma.<model>.<method>`
 * is a vi.fn created on first access with a sensible default (findMany/groupBy → [],
 * count → 0, updateMany/deleteMany → { count: 1 }, everything else → null).
 * `$transaction(fn)` runs `fn` with the same mock.
 */
import type { Prisma } from '@prisma/client';
import { type Mock, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';

type Method =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findMany'
  | 'create'
  | 'update'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'updateMany'
  | 'count'
  | 'groupBy'
  | 'aggregate';
type ModelKey = Uncapitalize<Prisma.ModelName>;

export type MockModel = Record<Method, Mock>;
export type MockPrisma = Record<ModelKey, MockModel> & {
  $transaction: Mock;
  $executeRaw: Mock;
  $queryRaw: Mock;
};

function defaultFor(method: string): unknown {
  if (method === 'findMany' || method === 'groupBy') return [];
  if (method === 'count') return 0;
  if (method === 'updateMany' || method === 'deleteMany') return { count: 1 };
  return null;
}

export function createMockPrisma(): { mock: MockPrisma; prisma: PrismaService } {
  const models = new Map<string, MockModel>();
  const root: Record<string, unknown> = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => []),
  };
  const proxy = new Proxy(root, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      let model = models.get(prop);
      if (!model) {
        const fns: Record<string, Mock> = {};
        model = new Proxy(fns, {
          get(m, method) {
            if (typeof method !== 'string') return undefined;
            m[method] ??= vi.fn(async () => defaultFor(method));
            return m[method];
          },
        }) as unknown as MockModel;
        models.set(prop, model);
      }
      return model;
    },
  }) as unknown as MockPrisma;
  root.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(proxy)
      : Promise.all(arg as unknown[]),
  );
  return { mock: proxy, prisma: proxy as unknown as PrismaService };
}
