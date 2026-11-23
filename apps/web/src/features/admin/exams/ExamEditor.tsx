'use client';

import { examConfigSchema } from '@onlinedars/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/api/admin/content';
import {
  createExamQuestion,
  deleteExamQuestion,
  getExam,
  listExamQuestions,
  saveExam,
  updateExamQuestion,
} from '@/lib/api/admin/management';
import type { AdminExam } from '@/lib/api/admin/types';
import { Pagination } from '../common/controls';
import { byPosition } from '../common/reorder';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  CheckboxField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Section,
  TableWrap,
} from '../common/ui';
import { mappedZodResolver } from '../common/zodResolver';
import { CourseTabs, useCourse } from '../courses/CourseEditor';
import { CourseStatusBadge } from '../courses/CourseStatus';
import { QuestionsPanel } from '../questions/QuestionsPanel';

export interface ExamForm {
  title: string;
  questionCount: string;
  timeLimitMinutes: string;
  passScore: string;
  maxAttempts: string;
  shuffleQuestions: boolean;
  isActive: boolean;
}

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s));
export const toExamInput = (v: ExamForm) => ({
  title: v.title.trim(),
  questionCount: num(v.questionCount),
  timeLimitMinutes: num(v.timeLimitMinutes),
  passScore: num(v.passScore),
  maxAttempts: v.maxAttempts.trim() === '' ? null : Number(v.maxAttempts),
  shuffleQuestions: v.shuffleQuestions,
  isActive: v.isActive,
});

const fromExam = (e: AdminExam | null, courseTitle: string): ExamForm => ({
  title: e?.title ?? courseTitle,
  questionCount: String(e?.questionCount ?? 20),
  timeLimitMinutes: String(e?.timeLimitMinutes ?? 30),
  passScore: String(e?.passScore ?? 70),
  maxAttempts: e?.maxAttempts == null ? '' : String(e.maxAttempts),
  shuffleQuestions: e?.shuffleQuestions ?? true,
  isActive: e?.isActive ?? true,
});

function ExamConfigForm({
  courseId,
  exam,
  courseTitle,
}: {
  courseId: string;
  exam: AdminExam | null;
  courseTitle: string;
}) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const f = useForm<ExamForm>({
    defaultValues: fromExam(exam, courseTitle),
    resolver: mappedZodResolver(examConfigSchema, toExamInput),
  });
  const e = f.formState.errors;
  return (
    <Section title={t('exams.configTitle')}>
      <p className="text-muted-foreground mb-4 text-sm">{t('exams.unlockHint')}</p>
      <form
        noValidate
        className="grid gap-4 md:grid-cols-2"
        onSubmit={f.handleSubmit(async (v) => {
          try {
            const saved = await saveExam(courseId, toExamInput(v));
            qc.setQueryData(['admin', 'exam', courseId], saved);
            toast.success(t('exams.saved'));
          } catch (err) {
            toast.error(errMsg(err));
          }
        })}
      >
        <Field
          label={t('exams.fields.title')}
          error={vmsg(e.title?.message)}
          className="md:col-span-2"
        >
          {(id) => <Input id={id} {...f.register('title')} />}
        </Field>
        <Field label={t('exams.fields.questionCount')} error={vmsg(e.questionCount?.message)}>
          {(id) => (
            <Input id={id} type="number" min={1} max={200} {...f.register('questionCount')} />
          )}
        </Field>
        <Field label={t('exams.fields.timeLimitMinutes')} error={vmsg(e.timeLimitMinutes?.message)}>
          {(id) => (
            <Input id={id} type="number" min={1} max={600} {...f.register('timeLimitMinutes')} />
          )}
        </Field>
        <Field label={t('exams.fields.passScore')} error={vmsg(e.passScore?.message)}>
          {(id) => <Input id={id} type="number" min={1} max={100} {...f.register('passScore')} />}
        </Field>
        <Field label={t('exams.fields.maxAttempts')} error={vmsg(e.maxAttempts?.message)}>
          {(id) => <Input id={id} type="number" min={1} max={100} {...f.register('maxAttempts')} />}
        </Field>
        <CheckboxField
          label={t('exams.fields.shuffleQuestions')}
          {...f.register('shuffleQuestions')}
        />
        <CheckboxField label={t('exams.fields.isActive')} {...f.register('isActive')} />
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

export function ExamEditor({ courseId }: { courseId: string }) {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const course = useCourse(courseId);
  const exam = useQuery({
    queryKey: ['admin', 'exam', courseId],
    queryFn: () => getExam(courseId),
  });
  const qKey = ['admin', 'exam-questions', courseId] as const;
  const questions = useQuery({
    queryKey: qKey,
    queryFn: async () => byPosition(await listExamQuestions(courseId)),
    enabled: !!exam.data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: qKey });

  return (
    <>
      <PageHeader title={course.data?.title ?? t('exams.title')} />
      <CourseTabs courseId={courseId} active="exam" />
      {exam.isPending || course.isPending ? (
        <LoadingState />
      ) : exam.error ? (
        <ErrorState error={exam.error} onRetry={() => exam.refetch()} />
      ) : (
        <div className="grid gap-6">
          <ExamConfigForm
            key={exam.data?.id ?? 'new'}
            courseId={courseId}
            exam={exam.data}
            courseTitle={course.data?.title ?? ''}
          />
          {exam.data &&
            (questions.isPending ? (
              <LoadingState />
            ) : questions.error ? (
              <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
            ) : (
              <QuestionsPanel
                title={t('exams.pool')}
                questions={questions.data}
                headerExtra={
                  <Badge
                    tone={questions.data.length >= exam.data.questionCount ? 'success' : 'warning'}
                    data-testid="exam-pool-count"
                  >
                    {t('exams.poolCount', { count: questions.data.length })}
                  </Badge>
                }
                onCreate={async (input) => {
                  await createExamQuestion(courseId, input);
                  await refresh();
                  toast.success(t('questions.created'));
                }}
                onUpdate={async (id, input) => {
                  await updateExamQuestion(courseId, id, input);
                  await refresh();
                  toast.success(t('questions.updated'));
                }}
                onDelete={async (id) => {
                  try {
                    await deleteExamQuestion(courseId, id);
                    await refresh();
                  } catch (e) {
                    toast.error(errMsg(e));
                    throw e;
                  }
                }}
              />
            ))}
          {exam.data && questions.data && questions.data.length < exam.data.questionCount && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
              {t('exams.poolTooSmall', {
                pool: questions.data.length,
                count: exam.data.questionCount,
              })}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** /admin/exams — every course with a link to its exam config. */
export function ExamsList() {
  const t = useTranslations('admin');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin', 'courses', { page, exams: true }],
    queryFn: () => listCourses({ page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('exams.title')} description={t('exams.subtitle')} />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>{t('courses.fields.title')}</th>
                <th>{t('courses.fields.status')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.title}</td>
                  <td>
                    <CourseStatusBadge status={c.status} />
                  </td>
                  <td className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/courses/${c.id}/exam`}>{t('exams.configure')}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageSize={20} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
