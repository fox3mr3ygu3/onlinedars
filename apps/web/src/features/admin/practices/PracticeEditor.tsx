'use client';

import { QUESTIONS_PER_PRACTICE, practiceInputSchema } from '@onlinedars/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createQuestion,
  deleteQuestion,
  getPractice,
  listQuestions,
  updatePractice,
  updateQuestion,
} from '@/lib/api/admin/content';
import type { AdminPractice } from '@/lib/api/admin/types';
import { byPosition } from '../common/reorder';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import {
  CheckboxField,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Section,
  Textarea,
} from '../common/ui';
import { mappedZodResolver } from '../common/zodResolver';
import { lessonKeys } from '../lessons/LessonEditor';
import { QuestionsPanel } from '../questions/QuestionsPanel';

interface PracticeForm {
  title: string;
  description: string;
  isRequired: boolean;
  passScore: string;
}
const toInput = (v: PracticeForm) => ({
  title: v.title.trim(),
  description: v.description.trim() || null,
  isRequired: v.isRequired,
  passScore: v.passScore === '' ? 0 : Number(v.passScore),
});

function PracticeSettings({ practice }: { practice: AdminPractice }) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const f = useForm<PracticeForm>({
    defaultValues: {
      title: practice.title,
      description: practice.description ?? '',
      isRequired: practice.isRequired,
      passScore: String(practice.passScore),
    },
    resolver: mappedZodResolver(practiceInputSchema, toInput),
  });
  return (
    <Section title={t('practices.editTitle')}>
      <form
        noValidate
        className="grid gap-4 md:grid-cols-2"
        onSubmit={f.handleSubmit(async (v) => {
          try {
            const p = await updatePractice(practice.id, toInput(v));
            qc.setQueryData(['admin', 'practice', practice.id], p);
            toast.success(t('common.saved'));
          } catch (e) {
            toast.error(errMsg(e));
          }
        })}
      >
        <Field label={t('practices.fields.title')} error={vmsg(f.formState.errors.title?.message)}>
          {(id) => <Input id={id} {...f.register('title')} />}
        </Field>
        <Field
          label={t('practices.fields.passScore')}
          hint={t('practices.fields.passScoreHint')}
          error={vmsg(f.formState.errors.passScore?.message)}
        >
          {(id) => <Input id={id} type="number" min={0} max={100} {...f.register('passScore')} />}
        </Field>
        <Field label={t('practices.fields.description')} className="md:col-span-2">
          {(id) => <Textarea id={id} {...f.register('description')} />}
        </Field>
        <CheckboxField label={t('practices.fields.isRequired')} {...f.register('isRequired')} />
        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={f.formState.isSubmitting}>
            {f.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function PracticeEditor({ practiceId }: { practiceId: string }) {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const practice = useQuery({
    queryKey: ['admin', 'practice', practiceId],
    queryFn: () => getPractice(practiceId),
  });
  const qKey = ['admin', 'questions', practiceId] as const;
  const questions = useQuery({
    queryKey: qKey,
    queryFn: async () => byPosition(await listQuestions(practiceId)),
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: qKey });
    if (practice.data)
      await qc.invalidateQueries({ queryKey: lessonKeys.completeness(practice.data.lessonId) });
  };

  if (practice.isPending) return <LoadingState />;
  if (practice.error)
    return <ErrorState error={practice.error} onRetry={() => practice.refetch()} />;

  return (
    <>
      <PageHeader
        title={practice.data.title}
        back={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/admin/lessons/${practice.data.lessonId}/practices`}>
              <ArrowLeft aria-hidden />
              {t('questions.backToLesson')}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        <PracticeSettings key={practice.data.id} practice={practice.data} />
        {questions.isPending ? (
          <LoadingState />
        ) : questions.error ? (
          <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
        ) : (
          <QuestionsPanel
            title={t('questions.title')}
            questions={questions.data}
            limit={QUESTIONS_PER_PRACTICE}
            onCreate={async (input) => {
              await createQuestion(practiceId, input);
              await refresh();
              toast.success(t('questions.created'));
            }}
            onUpdate={async (id, input) => {
              await updateQuestion(id, input);
              await refresh();
              toast.success(t('questions.updated'));
            }}
            onDelete={async (id) => {
              try {
                await deleteQuestion(id);
                await refresh();
              } catch (e) {
                toast.error(errMsg(e));
                throw e;
              }
            }}
          />
        )}
      </div>
    </>
  );
}
