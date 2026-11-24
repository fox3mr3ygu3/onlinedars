import { Injectable } from '@nestjs/common';
import {
  type AuthPrincipal,
  PLATFORM_SETTINGS_DEFAULTS,
  type PlatformSettingKey,
  type PlatformSettings,
  platformSettingsSchema,
  type PlatformSettingsUpdate,
  PUBLIC_SETTING_KEYS,
  type PublicPlatformSettings,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const KEYS = Object.keys(PLATFORM_SETTINGS_DEFAULTS) as PlatformSettingKey[];

/** Merges stored rows over defaults; a stored value that no longer validates falls back. */
export function mergeSettings(rows: { key: string; value: unknown }[]): PlatformSettings {
  const out: Record<string, unknown> = { ...PLATFORM_SETTINGS_DEFAULTS };
  for (const row of rows) {
    if (!(KEYS as string[]).includes(row.key)) continue;
    const field = platformSettingsSchema.shape[row.key as PlatformSettingKey];
    const parsed = field.safeParse(row.value);
    if (parsed.success) out[row.key] = parsed.data;
  }
  return out as PlatformSettings;
}

export interface SettingsUpdateMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<PlatformSettings> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: KEYS } } });
    return mergeSettings(rows);
  }

  /** Typed single value for other modules (e.g. `maintenanceMode`). */
  async get<K extends PlatformSettingKey>(key: K): Promise<PlatformSettings[K]> {
    return (await this.getAll())[key];
  }

  async getPublic(): Promise<PublicPlatformSettings> {
    const all = await this.getAll();
    return Object.fromEntries(
      PUBLIC_SETTING_KEYS.map((k) => [k, all[k]]),
    ) as PublicPlatformSettings;
  }

  /** Upserts the given keys and writes one AuditLog row (before/after) in the same transaction. */
  async update(
    input: PlatformSettingsUpdate,
    actor: AuthPrincipal,
    meta: SettingsUpdateMeta = {},
  ): Promise<PlatformSettings> {
    const entries = Object.entries(input).filter(([, v]) => v !== undefined) as [
      PlatformSettingKey,
      unknown,
    ][];
    if (entries.length === 0) return this.getAll();
    return this.prisma.$transaction(async (tx) => {
      const beforeRows = await tx.setting.findMany({ where: { key: { in: KEYS } } });
      const before = mergeSettings(beforeRows);
      for (const [key, value] of entries) {
        const json = value as Prisma.InputJsonValue;
        await tx.setting.upsert({
          where: { key },
          create: { key, value: json, updatedById: actor.id },
          update: { value: json, updatedById: actor.id },
        });
      }
      const after = { ...before, ...Object.fromEntries(entries) } as PlatformSettings;
      const changed = entries.map(([k]) => k);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'settings.update',
          entityType: 'Setting',
          entityId: changed.join(','),
          before: Object.fromEntries(changed.map((k) => [k, before[k]])) as Prisma.InputJsonValue,
          after: Object.fromEntries(changed.map((k) => [k, after[k]])) as Prisma.InputJsonValue,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return after;
    });
  }
}
