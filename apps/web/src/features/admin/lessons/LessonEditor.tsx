'use client';

import { lessonInputSchema, practiceInputSchema } from '@onlinedars/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createPractice,
  deleteLesson,
  deletePractice,
  getCompleteness,
  getLesson,
  listPractices,
  publishLesson,
  unpublishLesson,
  updateLesson,
} from '@/lib/api/admin/content';
import type { AdminLesson } from '@/lib/api/admin/types';
import { ConfirmButton } from '../common/controls';
import { FormDialog } from '../common/FormDialog';
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
import { type LessonForm, LessonFields, toLessonInput } from '../courses/ProgramEditor';
import { PracticesBoard, PublishControl } from '../practices/PracticesBoard';
import { MaterialsEditor } from './MaterialsEditor';

export const lessonKeys = {
  lesson: (id: string) => ['admin', 'lesson', id] as const,
  completeness: (id: string) => ['admin', 'completeness', id] as const,
  practices: (id: string) => ['admin', 'practices', id] as const,
};

export function useLessonData(lessonId: string) {
  const lesson = useQuery({
    queryKey: lessonKeys.lesson(lessonId),
    queryFn: () => getLesson(lessonId),
  });
  const completeness = useQuery({
    queryKey: lessonKeys.completeness(lessonId),
    queryFn: () => getCompleteness(lessonId),
  });
  const practices = useQuery({
    queryKey: lessonKeys.practices(lessonId),
    queryFn: async () => byPosition(await listPractices(lessonId)),
  });
  return { lesson, completeness, practices };
}

function BackToCourse({ lesson }: { lesson: AdminLesson | undefined }) {
  const t = useTranslations('admin.lessons');
  const href = lesson?.courseId ? `/admin/courses/${lesson.courseId}/modules` : '/admin/courses';
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={href}>
        <ArrowLeft aria-hidden />
        {t('breadcrumbCourse')}
      </Link>
    </Button>
  );
}

interface PracticeForm {
  title: string;
  description: string;
  isRequired: boolean;
  passScore: string;
}
const toPracticeInput = (v: PracticeForm) => ({
  title: v.title.trim(),
  description: v.description.trim() || null,
  isRequired: v.isRequired,
  passScore: v.passScore === '' ? 0 : Number(v.passScore),
});

/** Practices board + publish control for a lesson (used on the lesson page and /practices). */
export function LessonPracticesSection({
  lessonId,
  withPublish = true,
}: {
  lessonId: string;
  withPublish?: boolean;
}) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const { lesson, completeness, practices } = useLessonData(lessonId);
  const [adding, setAdding] = useState(false);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: lessonKeys.completeness(lessonId) }),
      qc.invalidateQueries({ queryKey: lessonKeys.practices(lessonId) }),
      qc.invalidateQueries({ queryKey: lessonKeys.lesson(lessonId) }),
    ]);

  const publish = useMutation({
    mutationFn: (on: boolean) => (on ? publishLesson(lessonId) : unpublishLesson(lessonId)),
    onSuccess: (_d, on) => {
      toast.success(on ? t('lessons.publishedToast') : t('lessons.unpublishedToast'));
      void refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (practices.isPending || completeness.isPending) return <LoadingState />;
  if (practices.error)
    return <ErrorState error={practices.error} onRetry={() => practices.refetch()} />;
  if (completeness.error)
    return <ErrorState error={completeness.error} onRetry={() => completeness.refetch()} />;

  return (
    <div className="grid gap-6">
      {withPublish && lesson.data && (
        <Section title={t('lessons.publish')}>
          <PublishControl
            completeness={completeness.data}
            isPublished={lesson.data.isPublished}
            pending={publish.isPending}
            onPublish={() => publish.mutate(true)}
            onUnpublish={() => publish.mutate(false)}
          />
        </Section>
      )}
      <PracticesBoard
        practices={practices.data}
        completeness={completeness.data}
        onAdd={() => setAdding(true)}
        onDelete={async (id) => {
          await deletePractice(id);
          await refresh();
        }}
      />
      <FormDialog<PracticeForm, ReturnType<typeof toPracticeInput>>
        open={adding}
        onOpenChange={setAdding}
        title={t('practices.newTitle')}
        schema={practiceInputSchema}
        defaultValues={{
          title: t('practices.newTitle') + ` ${(practices.data?.length ?? 0) + 1}`,
          description: '',
          isRequired: true,
          passScore: '0',
        }}
        toInput={toPracticeInput}
        onSubmit={async (input) => {
          await createPractice(lessonId, input);
          await refresh();
          toast.success(t('common.saved'));
        }}
      >
        {(f) => (
          <>
            <Field
              label={t('practices.fields.title')}
              error={vmsg(f.formState.errors.title?.message)}
            >
              {(id) => <Input id={id} autoFocus {...f.register('title')} />}
            </Field>
            <Field label={t('practices.fields.description')}>
              {(id) => <Textarea id={id} {...f.register('description')} />}
            </Field>
            <Field
              label={t('practices.fields.passScore')}
              hint={t('practices.fields.passScoreHint')}
              error={vmsg(f.formState.errors.passScore?.message)}
            >
              {(id) => (
                <Input id={id} type="number" min={0} max={100} {...f.register('passScore')} />
              )}
            </Field>
            <CheckboxField label={t('practices.fields.isRequired')} {...f.register('isRequired')} />
          </>
        )}
      </FormDialog>
    </div>
  );
}

function LessonInfoForm({ lesson }: { lesson: AdminLesson }) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const f = useForm<LessonForm>({
    defaultValues: {
      title: lesson.title,
      summary: lesson.summary ?? '',
      durationMinutes: lesson.durationMinutes == null ? '' : String(lesson.durationMinutes),
      isRequired: lesson.isRequired,
    },
    resolver: mappedZodResolver(lessonInputSchema, toLessonInput),
  });
  return (
    <Section title={t('lessons.editTitle')}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={f.handleSubmit(async (v) => {
          try {
            const updated = await updateLesson(lesson.id, toLessonInput(v));
            qc.setQueryData(lessonKeys.lesson(lesson.id), updated);
            toast.success(t('common.saved'));
          } catch (e) {
            toast.error(errMsg(e));
          }
        })}
      >
        <LessonFields f={f} vmsg={vmsg} />
        <div className="flex justify-end">
          <Button type="submit" disabled={f.formState.isSubmitting}>
            {f.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function LessonEditor({ lessonId }: { lessonId: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const lesson = useQuery({
    queryKey: lessonKeys.lesson(lessonId),
    queryFn: () => getLesson(lessonId),
  });
  if (lesson.isPending) return <LoadingState />;
  if (lesson.error) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  return (
    <>
      <PageHeader
        title={lesson.data.title}
        back={<BackToCourse lesson={lesson.data} />}
        actions={
          <ConfirmButton
            onConfirm={async () => {
              await deleteLesson(lessonId);
              toast.success(t('common.deleted'));
              router.push(
                lesson.data.courseId
                  ? `/admin/courses/${lesson.data.courseId}/modules`
                  : '/admin/courses',
              );
            }}
          >
            {t('common.delete')}
          </ConfirmButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <LessonInfoForm key={lesson.data.id} lesson={lesson.data} />
          <MaterialsEditor lessonId={lessonId} />
          <LessonPracticesSection lessonId={lessonId} withPublish={false} />
        </div>
        <div className="lg:sticky lg:top-6">
          <LessonPublishCard lessonId={lessonId} />
        </div>
      </div>
    </>
  );
}

function LessonPublishCard({ lessonId }: { lessonId: string }) {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const { lesson, completeness } = useLessonData(lessonId);
  const m = useMutation({
    mutationFn: (on: boolean) => (on ? publishLesson(lessonId) : unpublishLesson(lessonId)),
    onSuccess: (_d, on) => {
      toast.success(on ? t('lessons.publishedToast') : t('lessons.unpublishedToast'));
      void qc.invalidateQueries({ queryKey: lessonKeys.lesson(lessonId) });
      void qc.invalidateQueries({ queryKey: lessonKeys.completeness(lessonId) });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!lesson.data) return null;
  return (
    <Section title={t('lessons.publish')}>
      <PublishControl
        completeness={completeness.data}
        isPublished={lesson.data.isPublished}
        pending={m.isPending || completeness.isPending}
        onPublish={() => m.mutate(true)}
        onUnpublish={() => m.mutate(false)}
      />
    </Section>
  );
}

export function LessonPracticesPage({ lessonId }: { lessonId: string }) {
  const t = useTranslations('admin');
  const lesson = useQuery({
    queryKey: lessonKeys.lesson(lessonId),
    queryFn: () => getLesson(lessonId),
  });
  return (
    <>
      <PageHeader
        title={
          lesson.data ? `${lesson.data.title} — ${t('practices.title')}` : t('practices.title')
        }
        back={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/admin/lessons/${lessonId}`}>
              <ArrowLeft aria-hidden />
              {t('lessons.openEditor')}
            </Link>
          </Button>
        }
      />
      <LessonPracticesSection lessonId={lessonId} />
    </>
  );
}
