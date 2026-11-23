'use client';

import type { PublicQuestion } from '@onlinedars/shared';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { PracticeResult } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { emptyAnswer } from './answers';
import { QuestionView } from './questions/QuestionView';

/** Graded result: score, pass state, then every question with the correct answer and explanation. */
export function PracticeResultView({
  result,
  questions,
  passScore,
  actions,
}: {
  result: PracticeResult;
  questions: PublicQuestion[];
  passScore: number;
  actions?: ReactNode;
}) {
  const t = useTranslations('practice.result');
  const { attempt } = result;
  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="space-y-6">
      <div
        role="status"
        className={cn(
          'rounded-xl border p-5',
          attempt.passed ? 'border-green-600/40 bg-green-50' : 'border-amber-500/40 bg-amber-50',
        )}
      >
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="mt-1 text-3xl font-bold" data-testid="practice-percent">
          {t('percent', { percent: Math.round(attempt.percent) })}
        </p>
        <p>{t('score', { correct: attempt.correctCount, total: attempt.totalCount })}</p>
        <p className="mt-2 font-medium">
          {attempt.passed ? t('passed') : t('failed', { score: passScore })}
        </p>
        {result.lesson.isCompleted ? <p className="mt-1">{t('lessonCompleted')}</p> : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <ol className="space-y-4">
        {result.questions.map((r, i) => {
          const q = byId.get(r.questionId);
          if (!q) return null;
          return (
            <li
              key={r.questionId}
              data-testid={`result-${r.questionId}`}
              data-correct={r.isCorrect}
              className="bg-card space-y-3 rounded-xl border p-4 sm:p-6"
            >
              <p
                className={cn(
                  'flex items-center gap-2 text-sm font-medium',
                  r.isCorrect ? 'text-green-700' : 'text-red-700',
                )}
              >
                {r.isCorrect ? (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                ) : (
                  <XCircle className="size-4" aria-hidden="true" />
                )}
                {r.isCorrect ? t('correct') : t('incorrect')}
                <span className="text-muted-foreground font-normal">
                  ({r.pointsAwarded}/{r.points})
                </span>
              </p>
              <QuestionView
                number={i + 1}
                question={q}
                value={r.answer ?? emptyAnswer(q.id)}
                onChange={() => undefined}
                disabled
                review={r.correctAnswer}
              />
              {!r.answer ? <p className="text-muted-foreground text-sm">{t('noAnswer')}</p> : null}
              {r.explanation ? (
                <div className="bg-secondary rounded-lg p-3 text-sm">
                  <p className="font-medium">{t('explanation')}</p>
                  <p className="whitespace-pre-line">{r.explanation}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
