'use client';

import { lessonInputSchema, moduleInputSchema } from '@onlinedars/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createLesson,
  createModule,
  deleteModule,
  listLessons,
  listModules,
  reorderLessons,
  reorderModules,
  updateModule,
} from '@/lib/api/admin/content';
import type { AdminLesson, AdminModule } from '@/lib/api/admin/types';
import { DeleteIconButton } from '../common/controls';
import { FormDialog } from '../common/FormDialog';
import { byPosition, orderIds } from '../common/reorder';
import { SortableList } from '../common/SortableList';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  CheckboxField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Textarea,
} from '../common/ui';
import { CourseTabs, useCourse } from './CourseEditor';

interface ModuleForm {
  title: string;
  description: string;
}
const toModuleInput = (v: ModuleForm) => ({
  title: v.title.trim(),
  description: v.description.trim() || null,
});

interface LessonForm {
  title: string;
  summary: string;
  durationMinutes: string;
  isRequired: boolean;
  isPreview: boolean;
}
const toLessonInput = (v: LessonForm) => ({
  title: v.title.trim(),
  summary: v.summary.trim() || null,
  durationMinutes: v.durationMinutes === '' ? null : Number(v.durationMinutes),
  isRequired: v.isRequired,
  isPreview: v.isPreview,
});

/** Persists a new order optimistically; rolls back by refetching if the API rejects it. */
function useReorder<T extends { id: string }>(
  key: readonly unknown[],
  save: (ids: string[]) => Promise<unknown>,
) {
  const qc = useQueryClient();
  const t = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  return async (next: T[]) => {
    qc.setQueryData(
      key,
      next.map((x, i) => ({ ...x, position: i + 1 })),
    );
    try {
      await save(orderIds(next));
      toast.success(t('orderSaved'));
    } catch (e) {
      toast.error(errMsg(e));
      await qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function ProgramEditor({ courseId }: { courseId: string }) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const qc = useQueryClient();
  const course = useCourse(courseId);
  const key = ['admin', 'modules', courseId] as const;
  const modules = useQuery({
    queryKey: key,
    queryFn: async () => byPosition(await listModules(courseId)),
  });
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; module: AdminModule } | null
  >(null);
  const reorder = useReorder<AdminModule>(key, (ids) => reorderModules(courseId, ids));

  return (
    <>
      <PageHeader
        title={course.data?.title ?? t('modules.title')}
        back={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/courses">{t('nav.courses')}</Link>
          </Button>
        }
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus aria-hidden />
            {t('modules.add')}
          </Button>
        }
      />
      <CourseTabs courseId={courseId} active="program" />
      {modules.isPending ? (
        <LoadingState />
      ) : modules.error ? (
        <ErrorState error={modules.error} onRetry={() => modules.refetch()} />
      ) : modules.data.length === 0 ? (
        <EmptyState>{t('modules.empty')}</EmptyState>
      ) : (
        <SortableList
          items={modules.data}
          label={(m) => m.title}
          onReorder={(next) => reorder(next)}
          renderItem={(m, i) => (
            <ModuleRow
              module={m}
              index={i}
              onEdit={() => setDialog({ mode: 'edit', module: m })}
              onDelete={async () => {
                await deleteModule(m.id);
                await qc.invalidateQueries({ queryKey: key });
              }}
            />
          )}
        />
      )}

      <FormDialog<ModuleForm, ReturnType<typeof toModuleInput>>
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === 'edit' ? t('modules.editTitle') : t('modules.newTitle')}
        schema={moduleInputSchema}
        defaultValues={
          dialog?.mode === 'edit'
            ? { title: dialog.module.title, description: dialog.module.description ?? '' }
            : { title: '', description: '' }
        }
        toInput={toModuleInput}
        onSubmit={async (input) => {
          if (dialog?.mode === 'edit') await updateModule(dialog.module.id, input);
          else await createModule(courseId, input);
          await qc.invalidateQueries({ queryKey: key });
          toast.success(t('common.saved'));
        }}
      >
        {(f) => (
          <>
            <Field
              label={t('modules.fields.title')}
              error={vmsg(f.formState.errors.title?.message)}
            >
              {(id) => <Input id={id} autoFocus {...f.register('title')} />}
            </Field>
            <Field label={t('modules.fields.description')}>
              {(id) => <Textarea id={id} {...f.register('description')} />}
            </Field>
          </>
        )}
      </FormDialog>
    </>
  );
}

function ModuleRow({
  module: m,
  index,
  onEdit,
  onDelete,
}: {
  module: AdminModule;
  index: number;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(index === 0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          )}
          <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
          <span className="truncate">{m.title}</span>
        </button>
        {m.lessons !== undefined && (
          <Badge>{t('modules.lessonsCount', { count: m.lessons.length })}</Badge>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('common.edit')}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
        <DeleteIconButton
          label={t('common.delete')}
          message={t('modules.deleteConfirm')}
          onConfirm={onDelete}
        />
      </div>
      {open && <LessonsOfModule moduleId={m.id} />}
    </div>
  );
}

function LessonsOfModule({ moduleId }: { moduleId: string }) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const qc = useQueryClient();
  const key = ['admin', 'lessons', moduleId] as const;
  const lessons = useQuery({
    queryKey: key,
    queryFn: async () => byPosition(await listLessons(moduleId)),
  });
  const [creating, setCreating] = useState(false);
  const reorder = useReorder<AdminLesson>(key, (ids) => reorderLessons(moduleId, ids));

  return (
    <div className="mt-3 grid gap-2 border-l pl-3 sm:pl-5">
      {lessons.isPending ? (
        <LoadingState />
      ) : lessons.error ? (
        <ErrorState error={lessons.error} onRetry={() => lessons.refetch()} />
      ) : lessons.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('lessons.empty')}</p>
      ) : (
        <SortableList
          items={lessons.data}
          label={(l) => l.title}
          onReorder={(next) => reorder(next)}
          renderItem={(l, i) => (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/lessons/${l.id}`}
                className="text-primary min-w-0 flex-1 truncate text-sm hover:underline"
              >
                <span className="text-muted-foreground mr-1 tabular-nums">{i + 1}.</span>
                {l.title}
              </Link>
              {l.isPreview && <Badge tone="info">{t('lessons.previewBadge')}</Badge>}
              <Badge tone={l.isPublished ? 'success' : 'neutral'}>
                {l.isPublished ? t('lessons.published') : t('lessons.draft')}
              </Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/lessons/${l.id}/practices`}>{t('lessons.practicesLink')}</Link>
              </Button>
            </div>
          )}
        />
      )}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t('lessons.add')}
        </Button>
      </div>
      <FormDialog<LessonForm, ReturnType<typeof toLessonInput>>
        open={creating}
        onOpenChange={setCreating}
        title={t('lessons.newTitle')}
        schema={lessonInputSchema}
        defaultValues={{
          title: '',
          summary: '',
          durationMinutes: '',
          isRequired: true,
          isPreview: false,
        }}
        toInput={toLessonInput}
        onSubmit={async (input) => {
          await createLesson(moduleId, input);
          await qc.invalidateQueries({ queryKey: key });
          toast.success(t('common.saved'));
        }}
      >
        {(f) => <LessonFields f={f} vmsg={vmsg} />}
      </FormDialog>
    </div>
  );
}

export function LessonFields({
  f,
  vmsg,
}: {
  f: import('react-hook-form').UseFormReturn<LessonForm>;
  vmsg: (m: string | undefined) => string | undefined;
}) {
  const t = useTranslations('admin.lessons.fields');
  return (
    <>
      <Field label={t('title')} error={vmsg(f.formState.errors.title?.message)}>
        {(id) => <Input id={id} autoFocus {...f.register('title')} />}
      </Field>
      <Field label={t('summary')}>{(id) => <Textarea id={id} {...f.register('summary')} />}</Field>
      <Field label={t('durationMinutes')} error={vmsg(f.formState.errors.durationMinutes?.message)}>
        {(id) => (
          <Input
            id={id}
            type="number"
            min={0}
            inputMode="numeric"
            {...f.register('durationMinutes')}
          />
        )}
      </Field>
      <CheckboxField label={t('isRequired')} {...f.register('isRequired')} />
      <CheckboxField label={t('isPreview')} {...f.register('isPreview')} />
    </>
  );
}

export type { LessonForm };
export { toLessonInput };
