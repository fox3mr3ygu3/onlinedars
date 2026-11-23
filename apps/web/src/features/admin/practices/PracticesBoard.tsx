'use client';

import { CheckCircle2, CircleAlert, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { AdminPractice, Completeness } from '@/lib/api/admin/types';
import { cn } from '@/lib/utils';
import { DeleteIconButton } from '../common/controls';
import { Badge, EmptyState, Section } from '../common/ui';
import {
  canAddPractice,
  canAddQuestion,
  canPublish,
  counterState,
  lessonQuestionTotals,
  questionsFor,
} from './completeness';

/** "Practices 3/4" / "Questions 5/6" pill. */
export function Counter({
  label,
  count,
  required,
  testId,
}: {
  label: string;
  count: number;
  required: number;
  testId?: string;
}) {
  const state = counterState(count, required);
  return (
    <Badge
      data-testid={testId}
      data-state={state}
      tone={state === 'complete' ? 'success' : state === 'over' ? 'danger' : 'warning'}
      className="text-sm"
    >
      {state === 'complete' ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <CircleAlert className="size-3.5" aria-hidden />
      )}
      {label}
    </Badge>
  );
}

/** Publish / unpublish buttons; publish stays disabled until the server reports 4 × 6 complete. */
export function PublishControl({
  completeness,
  isPublished,
  pending,
  onPublish,
  onUnpublish,
}: {
  completeness: Completeness | undefined;
  isPublished: boolean;
  pending?: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const t = useTranslations('admin');
  const ready = canPublish(completeness);
  const totals = lessonQuestionTotals(completeness);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isPublished ? 'success' : 'neutral'}>
          {isPublished ? t('lessons.published') : t('lessons.draft')}
        </Badge>
        <span className="text-muted-foreground text-sm" data-testid="lesson-total">
          {t('practices.lessonTotal', totals)}
        </span>
      </div>
      {isPublished ? (
        <Button type="button" variant="outline" disabled={pending} onClick={onUnpublish}>
          {t('lessons.unpublish')}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={!ready || pending}
          aria-describedby={!ready ? 'publish-blocked-hint' : undefined}
          onClick={onPublish}
        >
          {t('lessons.publish')}
        </Button>
      )}
      {!ready && !isPublished && (
        <p id="publish-blocked-hint" className="text-muted-foreground text-xs">
          {t('lessons.publishBlocked')}
        </p>
      )}
    </div>
  );
}

export function PracticesBoard({
  practices,
  completeness,
  onAdd,
  onDelete,
}: {
  practices: AdminPractice[];
  completeness: Completeness | undefined;
  onAdd: () => void;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const t = useTranslations('admin');
  const required = completeness?.required ?? 4;
  const qRequired = completeness?.questionsRequired ?? 6;
  const count = completeness?.practices ?? practices.length;
  const addAllowed = canAddPractice(count, required);

  return (
    <Section
      title={t('practices.title')}
      actions={
        <>
          <Counter
            testId="practices-counter"
            label={t('practices.counter', { count, required })}
            count={count}
            required={required}
          />
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            disabled={!addAllowed}
            title={!addAllowed ? t('practices.limitReached', { required }) : undefined}
          >
            <Plus aria-hidden />
            {t('practices.add')}
          </Button>
        </>
      }
    >
      {!addAllowed ? (
        <p className="text-muted-foreground mb-3 text-xs">
          {t('practices.limitReached', { required })}
        </p>
      ) : (
        <p className="text-muted-foreground mb-3 text-xs">
          {t('practices.missing', { count: required - count })}
        </p>
      )}
      {practices.length === 0 ? (
        <EmptyState>{t('practices.empty')}</EmptyState>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {practices.map((p, i) => {
            const qc = completeness ? questionsFor(completeness, p.id) : (p.questionsCount ?? 0);
            return (
              <li
                key={p.id}
                data-testid="practice-card"
                className={cn('bg-background flex flex-col gap-2 rounded-md border p-3')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    <span className="text-muted-foreground mr-1 tabular-nums">{i + 1}.</span>
                    {p.title}
                  </p>
                  <DeleteIconButton label={t('common.delete')} onConfirm={() => onDelete(p.id)} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Counter
                    testId={`questions-counter-${p.id}`}
                    label={t('practices.questionsCounter', { count: qc, required: qRequired })}
                    count={qc}
                    required={qRequired}
                  />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/practices/${p.id}`}>{t('practices.openQuestions')}</Link>
                  </Button>
                </div>
                {!canAddQuestion(qc, qRequired) ? null : (
                  <span className="sr-only">{t('practices.incomplete')}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
