'use client';

import type { QuestionInput } from '@onlinedars/shared';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AdminQuestion } from '@/lib/api/admin/types';
import { DeleteIconButton } from '../common/controls';
import { Badge, EmptyState, Section } from '../common/ui';
import { canAddQuestion } from '../practices/completeness';
import { Counter } from '../practices/PracticesBoard';
import { QuestionEditor } from './QuestionEditor';
import { fromQuestion } from './questionModel';

/**
 * Question list with add/edit/delete. With `limit` (practice: 6) it shows the "Questions n/6"
 * counter and disables "Add" at the limit. Exam pools pass no limit.
 */
export function QuestionsPanel({
  title,
  questions,
  limit,
  onCreate,
  onUpdate,
  onDelete,
  headerExtra,
}: {
  title: ReactNode;
  questions: AdminQuestion[];
  limit?: number;
  onCreate: (input: QuestionInput) => Promise<unknown>;
  onUpdate: (id: string, input: QuestionInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  headerExtra?: ReactNode;
}) {
  const t = useTranslations('admin');
  const [editing, setEditing] = useState<AdminQuestion | 'new' | null>(null);
  const addAllowed = limit === undefined || canAddQuestion(questions.length, limit);

  return (
    <Section
      title={title}
      actions={
        <>
          {headerExtra}
          {limit !== undefined && (
            <Counter
              testId="questions-counter"
              label={t('practices.questionsCounter', { count: questions.length, required: limit })}
              count={questions.length}
              required={limit}
            />
          )}
          <Button
            type="button"
            size="sm"
            disabled={!addAllowed}
            title={
              !addAllowed && limit ? t('questions.limitReached', { required: limit }) : undefined
            }
            onClick={() => setEditing('new')}
          >
            <Plus aria-hidden />
            {t('questions.add')}
          </Button>
        </>
      }
    >
      {!addAllowed && limit !== undefined && (
        <p className="text-muted-foreground mb-3 text-xs">
          {t('questions.limitReached', { required: limit })}
        </p>
      )}
      {questions.length === 0 ? (
        <EmptyState>{t('questions.empty')}</EmptyState>
      ) : (
        <ol className="grid gap-2">
          {questions.map((q, i) => (
            <li
              key={q.id}
              data-testid="question-row"
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('questions.number', { n: i + 1 })}
                  </span>
                  <Badge tone="info">{t(`questions.types.${q.type}`)}</Badge>
                  <Badge>{t('questions.points', { points: q.points })}</Badge>
                </div>
                <p className="line-clamp-2 text-sm">{q.prompt}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t('common.edit')}
                onClick={() => setEditing(q)}
              >
                <Pencil aria-hidden />
              </Button>
              <DeleteIconButton label={t('common.delete')} onConfirm={() => onDelete(q.id)} />
            </li>
          ))}
        </ol>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent
            closeLabel={t('common.close')}
            className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          >
            <DialogHeader>
              <DialogTitle>
                {editing === 'new' ? t('questionEditor.newTitle') : t('questionEditor.editTitle')}
              </DialogTitle>
            </DialogHeader>
            <QuestionEditor
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : fromQuestion(editing)}
              isEdit={editing !== 'new'}
              onCancel={() => setEditing(null)}
              onSubmit={async (input) => {
                if (editing === 'new') await onCreate(input);
                else await onUpdate(editing.id, input);
                setEditing(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </Section>
  );
}
