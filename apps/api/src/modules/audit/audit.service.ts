import { Injectable } from '@nestjs/common';
import type { AuditLogQuery, AuditLogView, Paginated } from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Anything with an `auditLog` delegate: the PrismaService or a transaction client. */
export type AuditDb = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AuditEntry {
  /** The user who made the change; omit for system/provider actions. */
  actorId?: string | null;
  /** Dotted verb, e.g. `enrollment.grant`, `settings.update`. */
  action: string;
  /** Model name, e.g. `Order`, `Enrollment`. */
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Converts Dates/BigInts to JSON-safe values for a Json column; `undefined` stays omitted. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

/**
 * Writes and reads the audit log. Exported globally so any module can record sensitive changes
 * (access requests, enrollments, settings). Pass the transaction client as `db` so the audit row
 * commits or rolls back together with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, db: AuditDb = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: toAuditJson(entry.before),
        after: toAuditJson(entry.after),
        reason: entry.reason ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 500) ?? null,
      },
    });
  }

  async list(query: AuditLogQuery): Promise<Paginated<AuditLogView>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before ?? null,
        after: r.after ?? null,
        reason: r.reason,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
        actor: r.actor,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
