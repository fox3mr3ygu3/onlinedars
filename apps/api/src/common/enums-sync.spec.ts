import * as Shared from '@onlinedars/shared';
import { $Enums } from '@prisma/client';
import { describe, expect, it } from 'vitest';

/** The shared enums (used by web + zod) must stay identical to the Prisma enums. */
describe('shared enums match Prisma enums', () => {
  const pairs = [
    'Role',
    'CourseStatus',
    'CourseLevel',
    'QuestionType',
    'LessonMaterialType',
    'EnrollmentSource',
    'AccessRequestStatus',
    'ExamAttemptStatus',
    'OtpPurpose',
    'NotificationType',
  ] as const;

  it.each(pairs)('%s', (name) => {
    const shared = Shared[name] as Record<string, string>;
    const prisma = $Enums[name] as Record<string, string>;
    expect(Object.values(shared).sort()).toEqual(Object.values(prisma).sort());
  });
});
