import { type AdminPractice, QUESTIONS_PER_PRACTICE } from '@onlinedars/shared';
import type { Practice } from '@prisma/client';

export type PracticeRow = Pick<
  Practice,
  'id' | 'lessonId' | 'title' | 'description' | 'position' | 'isRequired' | 'passScore'
> & { _count: { questions: number } };

export const practiceSelect = {
  id: true,
  lessonId: true,
  title: true,
  description: true,
  position: true,
  isRequired: true,
  passScore: true,
  _count: { select: { questions: true } },
} as const;

export function toAdminPractice(p: PracticeRow): AdminPractice {
  return {
    id: p.id,
    lessonId: p.lessonId,
    title: p.title,
    description: p.description,
    position: p.position,
    isRequired: p.isRequired,
    passScore: p.passScore,
    questionCount: p._count.questions,
    questionsRequired: QUESTIONS_PER_PRACTICE,
  };
}
