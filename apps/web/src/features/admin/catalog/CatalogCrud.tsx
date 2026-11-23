'use client';

import {
  type DirectionInput,
  type FaqInput,
  type TeacherInput,
  directionInputSchema,
  faqInputSchema,
  teacherInputSchema,
} from '@onlinedars/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { directionsApi, faqApi, teachersApi } from '@/lib/api/admin/management';
import type { AdminDirection, AdminFaq, AdminTeacher } from '@/lib/api/admin/types';
import { DeleteIconButton, FileUploadField } from '../common/controls';
import { FormDialog } from '../common/FormDialog';
import { useValidationMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  CheckboxField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  TableWrap,
  Textarea,
} from '../common/ui';
import { slugify } from '../courses/courseFormModel';

interface CrudApi<T, I> {
  list: () => Promise<T[]>;
  create: (b: I) => Promise<T>;
  update: (id: string, b: Partial<I>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

/** Generic list + create/edit dialog for the small catalog entities. */
function CrudPage<
  T extends { id: string; position: number; isActive: boolean },
  F extends Record<string, unknown>,
  I,
>({
  ns,
  queryKey,
  api,
  schema,
  empty,
  toForm,
  toInput,
  columns,
  fields,
}: {
  ns: 'directions' | 'teachers' | 'faq';
  queryKey: string;
  api: CrudApi<T, I>;
  schema: z.ZodType;
  empty: F;
  toForm: (row: T) => F;
  toInput: (f: F) => I;
  columns: { header: string; cell: (row: T) => ReactNode }[];
  fields: (f: UseFormReturn<F>, vmsg: (m: string | undefined) => string | undefined) => ReactNode;
}) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const qc = useQueryClient();
  const key = ['admin', queryKey];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => [...(await api.list())].sort((a, b) => a.position - b.position),
  });
  const [editing, setEditing] = useState<T | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title={t(`${ns}.title`)}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {t(`${ns}.new`)}
          </Button>
        }
      />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header}>{c.header}</th>
              ))}
              <th>{t('common.position')}</th>
              <th>{t('courses.fields.status')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.header}>{c.cell(row)}</td>
                ))}
                <td className="tabular-nums">{row.position}</td>
                <td>
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </td>
                <td className="whitespace-nowrap text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => setEditing(row)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <DeleteIconButton
                    label={t('common.delete')}
                    onConfirm={async () => {
                      await api.remove(row.id);
                      await qc.invalidateQueries({ queryKey: key });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <FormDialog<F, I>
        wide
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t(`${ns}.new`) : t(`${ns}.editTitle`)}
        schema={schema}
        defaultValues={(editing && editing !== 'new' ? toForm(editing) : empty) as never}
        toInput={toInput}
        onSubmit={async (input) => {
          if (editing && editing !== 'new') await api.update(editing.id, input);
          else await api.create(input);
          await qc.invalidateQueries({ queryKey: key });
          toast.success(t('common.saved'));
        }}
      >
        {(f) => fields(f, vmsg)}
      </FormDialog>
    </>
  );
}

const pos = (s: string) => (s.trim() === '' ? 0 : Number(s));
const orNull = (s: string) => s.trim() || null;

// ---------- directions ----------
type DirectionForm = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  position: string;
  isActive: boolean;
};

export function DirectionsPage() {
  const t = useTranslations('admin.directions.fields');
  return (
    <CrudPage<AdminDirection, DirectionForm, DirectionInput>
      ns="directions"
      queryKey="directions"
      api={directionsApi}
      schema={directionInputSchema}
      empty={{ name: '', slug: '', description: '', icon: '', position: '0', isActive: true }}
      toForm={(d) => ({
        name: d.name,
        slug: d.slug,
        description: d.description ?? '',
        icon: d.icon ?? '',
        position: String(d.position),
        isActive: d.isActive,
      })}
      toInput={(f) => ({
        name: f.name.trim(),
        slug: f.slug.trim(),
        description: orNull(f.description),
        icon: orNull(f.icon),
        position: pos(f.position),
        isActive: f.isActive,
      })}
      columns={[
        { header: t('name'), cell: (d) => <span className="font-medium">{d.name}</span> },
        { header: t('slug'), cell: (d) => <span className="font-mono text-xs">{d.slug}</span> },
      ]}
      fields={(f, vmsg) => (
        <>
          <Field label={t('name')} error={vmsg(f.formState.errors.name?.message as string)}>
            {(id) => (
              <Input
                id={id}
                {...f.register('name', {
                  onBlur: (e) =>
                    !f.getValues('slug') && f.setValue('slug', slugify(e.target.value)),
                })}
              />
            )}
          </Field>
          <Field label={t('slug')} error={vmsg(f.formState.errors.slug?.message as string)}>
            {(id) => <Input id={id} {...f.register('slug')} />}
          </Field>
          <Field label={t('description')}>
            {(id) => <Textarea id={id} {...f.register('description')} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('icon')}>{(id) => <Input id={id} {...f.register('icon')} />}</Field>
            <Field
              label={t('position')}
              error={vmsg(f.formState.errors.position?.message as string)}
            >
              {(id) => <Input id={id} type="number" min={0} {...f.register('position')} />}
            </Field>
          </div>
          <CheckboxField label={t('isActive')} {...f.register('isActive')} />
        </>
      )}
    />
  );
}

// ---------- teachers ----------
type TeacherForm = {
  fullName: string;
  slug: string;
  title: string;
  bio: string;
  photoUrl: string;
  position: string;
  isActive: boolean;
};

export function TeachersPage() {
  const t = useTranslations('admin.teachers.fields');
  return (
    <CrudPage<AdminTeacher, TeacherForm, TeacherInput>
      ns="teachers"
      queryKey="teachers"
      api={teachersApi}
      schema={teacherInputSchema}
      empty={{
        fullName: '',
        slug: '',
        title: '',
        bio: '',
        photoUrl: '',
        position: '0',
        isActive: true,
      }}
      toForm={(d) => ({
        fullName: d.fullName,
        slug: d.slug,
        title: d.title ?? '',
        bio: d.bio ?? '',
        photoUrl: d.photoUrl ?? '',
        position: String(d.position),
        isActive: d.isActive,
      })}
      toInput={(f) => ({
        fullName: f.fullName.trim(),
        slug: f.slug.trim(),
        title: orNull(f.title),
        bio: orNull(f.bio),
        photoUrl: orNull(f.photoUrl),
        position: pos(f.position),
        isActive: f.isActive,
      })}
      columns={[
        { header: t('fullName'), cell: (d) => <span className="font-medium">{d.fullName}</span> },
        { header: t('title'), cell: (d) => d.title ?? '—' },
      ]}
      fields={(f, vmsg) => (
        <>
          <Field label={t('fullName')} error={vmsg(f.formState.errors.fullName?.message as string)}>
            {(id) => (
              <Input
                id={id}
                {...f.register('fullName', {
                  onBlur: (e) =>
                    !f.getValues('slug') && f.setValue('slug', slugify(e.target.value)),
                })}
              />
            )}
          </Field>
          <Field label={t('slug')} error={vmsg(f.formState.errors.slug?.message as string)}>
            {(id) => <Input id={id} {...f.register('slug')} />}
          </Field>
          <Field label={t('title')}>{(id) => <Input id={id} {...f.register('title')} />}</Field>
          <Field label={t('bio')}>
            {(id) => <Textarea id={id} rows={4} {...f.register('bio')} />}
          </Field>
          <Controller
            control={f.control}
            name="photoUrl"
            render={({ field }) => (
              <FileUploadField
                label={t('photo')}
                image
                purpose="teacher-photo"
                value={field.value as string}
                onChange={(u) => field.onChange(u ?? '')}
              />
            )}
          />
          <Field label={t('position')}>
            {(id) => <Input id={id} type="number" min={0} {...f.register('position')} />}
          </Field>
          <CheckboxField label={t('isActive')} {...f.register('isActive')} />
        </>
      )}
    />
  );
}

// ---------- FAQ ----------
type FaqForm = { question: string; answer: string; position: string; isActive: boolean };

export function FaqPage() {
  const t = useTranslations('admin.faq.fields');
  return (
    <CrudPage<AdminFaq, FaqForm, FaqInput>
      ns="faq"
      queryKey="faq"
      api={faqApi}
      schema={faqInputSchema}
      empty={{ question: '', answer: '', position: '0', isActive: true }}
      toForm={(d) => ({
        question: d.question,
        answer: d.answer,
        position: String(d.position),
        isActive: d.isActive,
      })}
      toInput={(f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
        position: pos(f.position),
        isActive: f.isActive,
      })}
      columns={[
        { header: t('question'), cell: (d) => <span className="line-clamp-2">{d.question}</span> },
      ]}
      fields={(f, vmsg) => (
        <>
          <Field label={t('question')} error={vmsg(f.formState.errors.question?.message as string)}>
            {(id) => <Input id={id} {...f.register('question')} />}
          </Field>
          <Field label={t('answer')} error={vmsg(f.formState.errors.answer?.message as string)}>
            {(id) => <Textarea id={id} rows={6} {...f.register('answer')} />}
          </Field>
          <Field label={t('position')}>
            {(id) => <Input id={id} type="number" min={0} {...f.register('position')} />}
          </Field>
          <CheckboxField label={t('isActive')} {...f.register('isActive')} />
        </>
      )}
    />
  );
}
