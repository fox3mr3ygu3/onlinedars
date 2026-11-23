'use client';

import type { QuestionAnswer } from '@onlinedars/shared';
import { ErrorCode } from '@onlinedars/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Lock, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { learningApi } from '@/lib/api/learning';
import type {
  ExamAttemptView,
  ExamSubmitResult,
  StudentExamStatus,
} from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { cabinetRoutes, qk } from '../cabinet/routes';
import { ProgressBar, QueryBoundary, useErrorMessage } from '../cabinet/ui';
import { clearExamAnswers } from './exam-storage';
import { ExamRunner } from './ExamRunner';

type Phase =
  | { kind: 'status' }
  | { kind: 'running'; attempt: ExamAttemptView }
  | { kind: 'result'; result: ExamSubmitResult };

/** Errors that mean the attempt is over on the server: go back to the status view. */
const CLOSED_CODES: string[] = [ErrorCode.EXAM_TIME_OVER, 'EXAM_ATTEMPT_CLOSED'];

export function ExamScreen({ courseId }: { courseId: string }) {
  const t = useTranslations('exam');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: 'status' });
  const status = useQuery({
    queryKey: qk.exam(courseId),
    queryFn: () => learningApi.examStatus(courseId),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: qk.exam(courseId) });
    void queryClient.invalidateQueries({ queryKey: qk.course(courseId) });
    void queryClient.invalidateQueries({ queryKey: qk.dashboard });
    void queryClient.invalidateQueries({ queryKey: ['me', 'results'] });
    void queryClient.invalidateQueries({ queryKey: qk.certificates });
  };

  const start = useMutation({
    mutationFn: () => learningApi.startExam(courseId),
    onSuccess: (attempt) => setPhase({ kind: 'running', attempt }),
    onError: (e) => {
      toast.error(errorMessage(e));
      refreshAll();
    },
  });

  const submit = useMutation({
    mutationFn: ({
      attemptId,
      answers,
    }: {
      attemptId: string;
      answers: QuestionAnswer[];
      auto: boolean;
    }) => learningApi.submitExam(attemptId, answers),
    onSuccess: (result, vars) => {
      clearExamAnswers(vars.attemptId);
      if (vars.auto) toast.info(t('autoSubmitted'));
      setPhase({ kind: 'result', result });
      window.scrollTo?.({ top: 0 });
      refreshAll();
    },
    onError: (e, vars) => {
      toast.error(errorMessage(e));
      if (e instanceof ApiError && CLOSED_CODES.includes(e.code)) {
        clearExamAnswers(vars.attemptId);
        setPhase({ kind: 'status' });
        refreshAll();
      }
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      {phase.kind !== 'running' ? (
        <Link
          href={cabinetRoutes.course(courseId)}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('back')}
        </Link>
      ) : null}

      {phase.kind === 'running' ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{phase.attempt.title}</h1>
          <ExamRunner
            attempt={phase.attempt}
            submitting={submit.isPending}
            onSubmit={(answers, auto) =>
              submit.mutate({ attemptId: phase.attempt.id, answers, auto })
            }
          />
        </div>
      ) : phase.kind === 'result' ? (
        <ExamResultView
          result={phase.result}
          courseId={courseId}
          onRetry={() => {
            setPhase({ kind: 'status' });
          }}
        />
      ) : (
        <QueryBoundary query={status}>
          {(s) => (
            <ExamStatusView status={s} starting={start.isPending} onStart={() => start.mutate()} />
          )}
        </QueryBoundary>
      )}
    </div>
  );
}

export function ExamStatusView({
  status: s,
  starting,
  onStart,
}: {
  status: StudentExamStatus;
  starting: boolean;
  onStart: () => void;
}) {
  const t = useTranslations('exam');
  const tr = useTranslations('results');
  const canStart = !s.isLocked && !!s.exam;

  return (
    <div className="space-y-6">
      <header
        className="bg-card space-y-3 rounded-xl border p-5"
        data-testid="exam-status"
        data-locked={s.isLocked}
      >
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          {s.isLocked ? <Lock className="size-5" aria-label={t('locked')} /> : null}
          {s.exam?.title ?? t('title')}
        </h1>
        {s.exam ? (
          <ul className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
            <li>{t('questionCount', { count: s.exam.questionCount })}</li>
            <li>{t('timeLimit', { minutes: s.exam.timeLimitMinutes })}</li>
            <li>{t('passScore', { score: s.exam.passScore })}</li>
            <li>
              {t('attempts', { used: s.attemptsUsed })}
              {s.attemptsLeft !== null ? ` · ${t('attemptsLeft', { count: s.attemptsLeft })}` : ''}
            </li>
          </ul>
        ) : null}
      </header>

      {s.isLocked && s.lockReason ? (
        <div role="status" className="bg-secondary space-y-3 rounded-xl p-4">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="size-4" aria-hidden="true" />
            {t(`lockReason.${s.lockReason}`)}
          </p>
          {s.lockReason === 'LESSONS_INCOMPLETE' ? (
            <>
              <ProgressBar
                value={s.progress.percent}
                label={t('lessonsProgress', {
                  done: s.progress.completedRequired,
                  total: s.progress.totalRequired,
                })}
              />
              <p className="text-muted-foreground text-sm">
                {t('lessonsProgress', {
                  done: s.progress.completedRequired,
                  total: s.progress.totalRequired,
                })}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {s.lastResult && s.lastResult.status !== 'IN_PROGRESS' ? (
        <section className="bg-card rounded-xl border p-4">
          <h2 className="mb-1 font-medium">{t('lastResult')}</h2>
          <p className="text-sm">
            {s.lastResult.percent !== null ? `${Math.round(s.lastResult.percent)}% · ` : ''}
            {s.lastResult.passed ? tr('passed') : tr('failed')} ·{' '}
            {t(`status.${s.lastResult.status}`)}
          </p>
        </section>
      ) : null}

      {s.certificate ? (
        <Button asChild variant="outline">
          <Link href={cabinetRoutes.certificates}>{t('result.certificate')}</Link>
        </Button>
      ) : null}

      {canStart ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{t('startWarning')}</p>
          <Button size="lg" onClick={onStart} disabled={starting}>
            {starting ? t('starting') : s.activeAttempt ? t('resume') : t('start')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ExamResultView({
  result: r,
  courseId,
  onRetry,
}: {
  result: ExamSubmitResult;
  courseId: string;
  onRetry: () => void;
}) {
  const t = useTranslations('exam.result');
  const passed = !!r.passed;
  return (
    <div className="space-y-6" data-testid="exam-result" data-passed={passed}>
      <section
        role="status"
        className={cn(
          'space-y-2 rounded-xl border p-5',
          passed ? 'border-green-600/40 bg-green-50' : 'border-amber-500/40 bg-amber-50',
        )}
      >
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-lg font-medium">{passed ? t('passed') : t('failed')}</p>
        {r.percent !== null ? (
          <p className="text-3xl font-bold">{t('percent', { percent: Math.round(r.percent) })}</p>
        ) : null}
        <p>{t('score', { correct: r.correctCount, total: r.totalCount })}</p>
        <p className="text-muted-foreground text-sm">{t('passScore', { score: r.passScore })}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {r.certificate ? (
            <Button asChild>
              <Link href={cabinetRoutes.certificates}>{t('certificate')}</Link>
            </Button>
          ) : null}
          {!passed ? (
            <Button variant="outline" onClick={onRetry}>
              {t('retry')}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={cabinetRoutes.course(courseId)}>{t('backToCourse')}</Link>
          </Button>
        </div>
      </section>
      {/* Only per-question correctness: exam answers are never revealed. */}
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {r.questions.map((q, i) => (
          <li
            key={q.questionId}
            className={cn(
              'flex aspect-square items-center justify-center rounded-md border text-sm',
              q.isCorrect ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50',
            )}
            aria-label={
              q.isCorrect
                ? t('questionCorrect', { number: i + 1 })
                : t('questionIncorrect', { number: i + 1 })
            }
          >
            {q.isCorrect ? (
              <CheckCircle2 className="size-4 text-green-700" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 text-red-700" aria-hidden="true" />
            )}
            <span className="sr-only">{i + 1}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
