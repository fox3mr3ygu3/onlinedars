'use client';

import type { PublicQuestion } from '@onlinedars/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '../cabinet/ConfirmDialog';
import { type AnswerMap, countUnanswered, emptyAnswer, isAnswered, toSubmission } from './answers';
import { QuestionView } from './questions/QuestionView';

interface Props {
  questions: PublicQuestion[];
  submitting?: boolean;
  onSubmit: (answers: ReturnType<typeof toSubmission>) => void;
  initialAnswers?: AnswerMap;
}

/** Step-by-step player for a practice's questions (6 per practice). Grading happens on the server. */
export function PracticePlayer({ questions, submitting, onSubmit, initialAnswers }: Props) {
  const t = useTranslations('practice');
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers ?? {});
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (questions.length === 0) {
    return <p className="text-muted-foreground">{t('noQuestions')}</p>;
  }

  const q = questions[Math.min(index, questions.length - 1)]!;
  const unanswered = countUnanswered(questions, answers);
  const isLast = index === questions.length - 1;

  function submit() {
    onSubmit(toSubmission(questions, answers));
  }

  function requestSubmit() {
    if (unanswered > 0) setConfirmOpen(true);
    else submit();
  }

  return (
    <div className="space-y-6">
      <nav aria-label={t('questionOf', { current: index + 1, total: questions.length })}>
        <ol className="flex flex-wrap gap-2">
          {questions.map((item, i) => {
            const done = isAnswered(item, answers[item.id]);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`${t('goTo', { number: i + 1 })} — ${done ? t('answered') : t('notAnswered')}`}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                    'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                    done && 'bg-primary/10 border-primary/40',
                    i === index && 'bg-primary text-primary-foreground border-primary',
                  )}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="bg-card rounded-xl border p-4 sm:p-6">
        <QuestionView
          key={q.id}
          number={index + 1}
          total={questions.length}
          question={q}
          value={answers[q.id] ?? emptyAnswer(q.id)}
          onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft aria-hidden="true" />
          {t('prev')}
        </Button>
        <div className="flex gap-2">
          {!isLast ? (
            <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>
              {t('next')}
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            onClick={requestSubmit}
            disabled={submitting}
            variant={isLast ? 'default' : 'secondary'}
          >
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('submit')}
        description={t('unanswered', { count: unanswered })}
        confirmLabel={t('confirmSubmit')}
        onConfirm={submit}
      />
    </div>
  );
}
