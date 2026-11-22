/**
 * Minimal in-memory stand-in for the parts of PrismaClient used by auth/users, so unit tests
 * run without a database. Supports only the query shapes those services use.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'not' in (v as Row)) {
      return row[k] !== (v as Row).not;
    }
    return v === null ? row[k] === null || row[k] === undefined : row[k] === v;
  });
}

function pick(
  row: Row | undefined,
  select?: Row,
  resolve?: (key: string, row: Row) => unknown,
): Row | null {
  if (!row) return null;
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) {
    if (v === true) out[k] = row[k];
    else if (v && typeof v === 'object' && resolve) {
      out[k] = pick(resolve(k, row) as Row, (v as { select?: Row }).select);
    }
  }
  return out;
}

class Table {
  rows: Row[] = [];
  constructor(
    private readonly defaults: () => Row,
    private readonly unique: string[] = [],
    private readonly resolve?: (key: string, row: Row) => unknown,
  ) {}

  private findOneByWhere(where: Row): Row | undefined {
    const [key, value] = Object.entries(where)[0] ?? [];
    if (key === 'userId_courseId') return this.rows.find((r) => matches(r, value as Row));
    return this.rows.find((r) => matches(r, where));
  }

  async findUnique({ where, select }: { where: Row; select?: Row }) {
    return pick(this.findOneByWhere(where), select, this.resolve);
  }

  async findFirst({ where, select, orderBy }: { where?: Row; select?: Row; orderBy?: Row }) {
    let rows = this.rows.filter((r) => matches(r, where));
    if (orderBy) {
      const [k, dir] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
      rows = [...rows].sort((a, b) => {
        const av = a[k] as Date;
        const bv = b[k] as Date;
        return (av.getTime() - bv.getTime()) * (dir === 'desc' ? -1 : 1);
      });
    }
    return pick(rows[0], select, this.resolve);
  }

  async create({ data, select }: { data: Row; select?: Row }) {
    for (const u of this.unique) {
      if (data[u] != null && this.rows.some((r) => r[u] === data[u])) {
        const err = Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: [u] },
        });
        throw err;
      }
    }
    const row = { ...this.defaults(), ...data };
    this.rows.push(row);
    return pick(row, select, this.resolve);
  }

  async update({ where, data, select }: { where: Row; data: Row; select?: Row }) {
    const row = this.findOneByWhere(where);
    if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
    Object.assign(row, data);
    return pick(row, select, this.resolve);
  }

  async updateMany({ where, data }: { where: Row; data: Row }) {
    const rows = this.rows.filter((r) => matches(r, where));
    rows.forEach((r) => Object.assign(r, data));
    return { count: rows.length };
  }
}

/** Fixed sequence so ordering by createdAt is deterministic within a test. */
let tick = 0;
const now = () => new Date(Date.now() + tick++);

export function createFakePrisma() {
  const user = new Table(
    () => ({
      id: randomUUID(),
      role: 'STUDENT',
      isActive: true,
      avatarUrl: null,
      email: null,
      phone: null,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now(),
      updatedAt: now(),
    }),
    ['email', 'phone'],
  );
  const session: Table = new Table(
    () => ({
      id: randomUUID(),
      revokedAt: null,
      revokedReason: null,
      createdAt: now(),
      lastUsedAt: now(),
      userAgent: null,
      ip: null,
    }),
    [],
    (key, row) => (key === 'user' ? user.rows.find((u) => u.id === row.userId) : undefined),
  );
  const otpCode = new Table(() => ({
    id: randomUUID(),
    attempts: 0,
    consumedAt: null,
    createdAt: now(),
  }));
  const enrollment = new Table(() => ({ id: randomUUID(), revokedAt: null, enrolledAt: now() }));
  return { user, session, otpCode, enrollment };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
