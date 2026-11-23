'use client';

import type { QuestionAnswer } from '@onlinedars/shared';
import { Clock, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ExamAttemptView } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '../cabinet/ConfirmDialog';
import {
  type AnswerMap,
  answersFromList,
  countUnanswered,
  emptyAnswer,
  isAnswered,
  toSubmission,
} from '../practice/answers';
import { QuestionView } from '../practice/questions/QuestionView';
import { loadExamAnswers, saveExamAnswers } from './exam-storage';
import { formatClock, useCountdown } from './useCountdown';

/** Seconds left at which the timer turns red. */
const WARN_MS = 60_000;

interface Props {
  attempt: ExamAttemptView;
  submitting?: boolean;
  /** `auto` = the deadline passed and the runner submitted on its own. */
  onSubmit: (answers: QuestionAnswer[], auto: boolean) => void;
}

/**
 * Timed exam: all questions on one page, server-deadline countdown, local autosave on every
 * change, manual submit with confirmation and automatic submit when the time is over.
 */
export function ExamRunner({ attempt, submitting, onSubmit }: Props) {
  const t = useTranslations('exam');
  const { questions } = attempt;
  const [answers, setAnswers] = useState<AnswerMap>(
    () => loadExamAnswers(attempt.id) ?? answersFromList(attempt.savedAnswers),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submitted = useRef(false);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
    saveExamAnswers(attempt.id, answers);
  }, [attempt.id, answers]);

  const submit = useCallback(
    (auto: boolean) => {
      if (submitted.current) return;
      submitted.current = true;
      setConfirmOpen(false);
      onSubmit(toSubmission(questions, answersRef.current), auto);
    },
    [onSubmit, questions],
  );

  const remaining = useCountdown(attempt.expiresAt, attempt.serverTime, () => submit(true));
  const unanswered = countUnanswered(questions, answers);
  const answeredCount = questions.length - unanswered;
  const clock = formatClock(remaining);

  return (
    <div className="space-y-6">
      <div className="bg-background/95 sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b px-4 py-3 backdrop-blur">
        <div
          role="timer"
          aria-live="off"
          aria-label={`${t('timeLeft')}: ${clock}`}
          data-testid="exam-timer"
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums',
            remaining <= WARN_MS && 'border-red-600 text-red-700',
          )}
        >
          <Clock className="size-4" aria-hidden="true" />
          {clock}
        </div>
        <span className="text-muted-foreground text-sm" data-testid="exam-answered">
          {t('answered', { answered: answeredCount, total: questions.length })}
        </span>
        <span className="text-muted-foreground hidden items-center gap-1 text-xs sm:inline-flex">
          <Save className="size-3.5" aria-hidden="true" />
          {t('autosaved')}
        </span>
        <Button
          className="ml-auto"
          onClick={() => setConfirmOpen(true)}
          disabled={submitting || submitted.current}
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>

      <nav aria-label={t('title')}>
        <ol className="flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <li key={q.id}>
              <a
                href={`#exam-q-${q.id}`}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border text-sm',
                  isAnswered(q, answers[q.id]) && 'bg-primary/10 border-primary/40',
                )}
              >
                {i + 1}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li
            key={q.id}
            id={`exam-q-${q.id}`}
            className="bg-card scroll-mt-32 rounded-xl border p-4 sm:p-6"
          >
            <QuestionView
              number={i + 1}
              total={questions.length}
              question={q}
              value={answers[q.id] ?? emptyAnswer(q.id)}
              onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
              disabled={submitting}
            />
          </li>
        ))}
      </ol>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('submit')}
        description={
          unanswered > 0 ? t('confirmSubmit', { count: unanswered }) : t('confirmSubmitAll')
        }
        confirmLabel={t('confirm')}
        onConfirm={() => submit(false)}
      />
    </div>
  );
}
