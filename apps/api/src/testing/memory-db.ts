/**
 * In-memory stand-in for the Prisma calls made by the access-request / audit / notifications
 * services, so their business rules are unit-tested without Postgres. It supports only the query shapes
 * those services use: equality, `in`, `not`, `lt/lte/gt/gte`, AND/OR, compound unique keys,
 * `select` of scalar fields, orderBy on one field, skip/take, and `$transaction` with rollback.
 * Real-database behaviour (row locks, constraints, includes) is covered by the e2e suite.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const OPS = ['in', 'notIn', 'not', 'lt', 'lte', 'gt', 'gte', 'contains'];

function isPlain(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v);
}

function cmp(a: unknown, b: unknown): number {
  const n = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number | bigint));
  const av = n(a);
  const bv = n(b);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function eq(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (b === null) return a === null || a === undefined;
  return a === b;
}

function matchValue(value: unknown, cond: unknown): boolean {
  if (isPlain(cond) && Object.keys(cond).some((k) => OPS.includes(k))) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case 'in':
          return (arg as unknown[]).some((x) => eq(value, x));
        case 'notIn':
          return !(arg as unknown[]).some((x) => eq(value, x));
        case 'not':
          return !eq(value, arg);
        case 'lt':
          return value != null && cmp(value, arg) < 0;
        case 'lte':
          return value != null && cmp(value, arg) <= 0;
        case 'gt':
          return value != null && cmp(value, arg) > 0;
        case 'gte':
          return value != null && cmp(value, arg) >= 0;
        case 'contains':
          return typeof value === 'string' && value.includes(arg as string);
        default:
          return true;
      }
    });
  }
  return eq(value, cond);
}

/** Flattens compound unique keys like `{ userId_courseId: { userId, courseId } }`. */
function flatten(where: Where): Where {
  const out: Where = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes('_') && isPlain(v)) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(flatten(where)).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'AND') return (v as Where[]).every((w) => matches(row, w));
    if (k === 'OR') return (v as Where[]).some((w) => matches(row, w));
    return matchValue(row[k], v);
  });
}

function pick(row: Row | undefined, select?: Row): Row | null {
  if (!row) return null;
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) if (v === true) out[k] = row[k];
  return out;
}

interface Args {
  include?: Row;
  where?: Where;
  data?: Row;
  select?: Row;
  orderBy?: Row;
  skip?: number;
  take?: number;
}

export class FakeTable {
  rows: Row[] = [];
  private seq = 0;
  /** Relation resolvers used for `include` (nested selects are ignored: full rows returned). */
  relations: Record<string, (row: Row) => unknown> = {};

  constructor(
    readonly name: string,
    private readonly defaults: (seq: number) => Row,
    /** Each entry is a set of columns that must be unique together (nulls ignored). */
    private readonly uniques: string[][] = [],
  ) {}

  private violates(candidate: Row, self?: Row): boolean {
    return this.uniques.some((cols) =>
      this.rows.some(
        (r) => r !== self && cols.every((c) => candidate[c] != null && eq(r[c], candidate[c])),
      ),
    );
  }

  private uniqueError(): Error {
    return Object.assign(new Error(`Unique constraint failed on ${this.name}`), { code: 'P2002' });
  }

  private withIncludes(row: Row | null, include?: Row): Row | null {
    if (!row || !include) return row;
    const src = this.rows.find((r) => r.id === row.id) ?? row;
    for (const k of Object.keys(include)) row[k] = this.relations[k]?.(src) ?? null;
    return row;
  }

  async findUnique({ where, select, include }: Args) {
    return this.withIncludes(
      pick(
        this.rows.find((r) => matches(r, where)),
        select,
      ),
      include,
    );
  }

  async findUniqueOrThrow(args: Args) {
    const row = await this.findUnique(args);
    if (!row) throw Object.assign(new Error(`${this.name} not found`), { code: 'P2025' });
    return row;
  }

  async findFirst(args: Args) {
    return (await this.findMany({ ...args, take: 1 }))[0] ?? null;
  }

  async findMany({ where, select, include, orderBy, skip = 0, take }: Args = {}) {
    let rows = this.rows.filter((r) => matches(r, where));
    if (orderBy) {
      const [k, dir] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
      rows = [...rows].sort((a, b) => cmp(a[k], b[k]) * (dir === 'desc' ? -1 : 1));
    }
    rows = rows.slice(skip, take === undefined ? undefined : skip + take);
    return rows.map((r) => this.withIncludes(pick(r, select), include) as Row);
  }

  async count({ where }: Args = {}) {
    return this.rows.filter((r) => matches(r, where)).length;
  }

  async create({ data, select }: Args) {
    const row: Row = { ...this.defaults(++this.seq), ...data };
    if (this.violates(row)) throw this.uniqueError();
    this.rows.push(row);
    return pick(row, select);
  }

  async update({ where, data, select }: Args) {
    const row = this.rows.find((r) => matches(r, where));
    if (!row) throw Object.assign(new Error(`${this.name} not found`), { code: 'P2025' });
    const next = { ...row, ...data, updatedAt: new Date() };
    if (this.violates(next, row)) throw this.uniqueError();
    Object.assign(row, next);
    return pick(row, select);
  }

  async updateMany({ where, data }: Args) {
    const rows = this.rows.filter((r) => matches(r, where));
    rows.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
    return { count: rows.length };
  }
}

export function createMemoryDb() {
  const now = () => new Date();
  const user = new FakeTable(
    'user',
    () => ({
      id: randomUUID(),
      role: 'STUDENT',
      isActive: true,
      email: null,
      phone: null,
      createdAt: now(),
    }),
    [['email'], ['phone']],
  );
  const course = new FakeTable('course', () => ({
    id: randomUUID(),
    status: 'PUBLISHED',
    createdAt: now(),
  }));
  const enrollment = new FakeTable(
    'enrollment',
    () => ({
      id: randomUUID(),
      enrolledAt: now(),
      completedAt: null,
      revokedAt: null,
    }),
    [['userId', 'courseId']],
  );
  const accessRequest = new FakeTable(
    'accessRequest',
    () => ({
      id: randomUUID(),
      status: 'PENDING',
      message: null,
      decisionReason: null,
      decidedById: null,
      decidedAt: null,
      createdAt: now(),
      updatedAt: now(),
    }),
    [['userId', 'courseId']],
  );
  const notification = new FakeTable('notification', () => ({
    id: randomUUID(),
    data: null,
    readAt: null,
    createdAt: now(),
  }));
  const auditLog = new FakeTable('auditLog', () => ({ id: randomUUID(), createdAt: now() }));
  const setting = new FakeTable('setting', () => ({ updatedAt: now() }), [['key']]);

  const byId = (t: FakeTable, key: string) => (row: Row) => t.rows.find((r) => r.id === row[key]);
  accessRequest.relations = {
    course: byId(course, 'courseId'),
    user: byId(user, 'userId'),
    decidedBy: byId(user, 'decidedById'),
  };
  auditLog.relations = { actor: byId(user, 'actorId') };

  const tables = { user, course, enrollment, accessRequest, notification, auditLog, setting };
  type Tables = typeof tables;
  interface FakeDb extends Tables {
    $queryRaw: () => Promise<unknown[]>;
    $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T>;
  }
  const db: FakeDb = {
    ...tables,
    /** Raw SQL is only used for `SELECT … FOR UPDATE` row locks: a no-op here. */
    $queryRaw: async () => [],
    async $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T> {
      const snapshot = Object.fromEntries(
        Object.entries(tables).map(([k, t]) => [k, structuredClone(t.rows)]),
      );
      try {
        return await fn(db);
      } catch (err) {
        for (const [k, t] of Object.entries(tables)) t.rows = snapshot[k] as Row[];
        throw err;
      }
    },
  };
  return db;
}

export type MemoryDb = ReturnType<typeof createMemoryDb>;
