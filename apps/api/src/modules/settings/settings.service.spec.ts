import { PLATFORM_SETTINGS_DEFAULTS, platformSettingsUpdateSchema } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { asPrisma, createPrismaMock, type PrismaMock } from '../courses/testing/prisma-mock';
import { mergeSettings, SettingsService } from './settings.service';

const admin = { id: 'admin1', role: 'ADMIN' as const, sessionId: 's1' };

describe('SettingsService', () => {
  let prisma: PrismaMock;
  let service: SettingsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SettingsService(asPrisma(prisma));
  });

  it('merges stored values over defaults and ignores invalid/unknown rows', () => {
    const s = mergeSettings([
      { key: 'platformName', value: 'Dars.uz' },
      { key: 'orderTtlMinutes', value: 'not a number' },
      { key: 'somethingElse', value: 1 },
    ]);
    expect(s.platformName).toBe('Dars.uz');
    expect(s.orderTtlMinutes).toBe(PLATFORM_SETTINGS_DEFAULTS.orderTtlMinutes);
    expect(s).not.toHaveProperty('somethingElse');
  });

  it('getPublic exposes only the public subset', async () => {
    prisma.setting.findMany.mockResolvedValue([{ key: 'refundPolicy', value: 'KEEP_ACCESS' }]);
    const pub = await service.getPublic();
    expect(pub).toHaveProperty('platformName');
    expect(pub).not.toHaveProperty('refundPolicy');
    expect(pub).not.toHaveProperty('orderTtlMinutes');
  });

  it('update upserts each key and writes an audit log row in the same transaction', async () => {
    prisma.setting.findMany.mockResolvedValue([{ key: 'platformName', value: 'Old' }]);
    prisma.setting.upsert.mockImplementation(async () => {
      expect(prisma.inTransaction).toBe(true);
      return {};
    });
    prisma.auditLog.create.mockImplementation(async () => {
      expect(prisma.inTransaction).toBe(true);
      return {};
    });
    const res = await service.update({ platformName: 'New', maintenanceMode: true }, admin, {
      ip: '1.2.3.4',
    });
    expect(res).toMatchObject({ platformName: 'New', maintenanceMode: true });
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin1',
        action: 'settings.update',
        entityType: 'Setting',
        before: { platformName: 'Old', maintenanceMode: false },
        after: { platformName: 'New', maintenanceMode: true },
        ip: '1.2.3.4',
      }),
    });
  });

  it('an empty update writes nothing', async () => {
    prisma.setting.findMany.mockResolvedValue([]);
    await service.update({}, admin);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('the PATCH schema rejects unknown keys and keeps omitted keys undefined', () => {
    expect(platformSettingsUpdateSchema.safeParse({ hacker: true }).success).toBe(false);
    expect(platformSettingsUpdateSchema.parse({ platformName: 'X' })).toEqual({
      platformName: 'X',
    });
  });
});
