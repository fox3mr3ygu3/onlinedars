'use client';

import { CourseLevel, courseInputSchema } from '@onlinedars/shared';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { certificateTemplatesApi, directionsApi, teachersApi } from '@/lib/api/admin/management';
import type { AdminCourse } from '@/lib/api/admin/types';
import { FileUploadField } from '../common/controls';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import { CheckboxField, Field, NativeSelect, Section, Textarea } from '../common/ui';
import { mappedZodResolver } from '../common/zodResolver';
import { RichTextEditor } from '../lessons/RichTextEditor';
import {
  type CourseFormValues,
  courseFieldFor,
  emptyCourseForm,
  fromCourse,
  slugify,
  toCourseInput,
} from './courseFormModel';

export function CourseForm({
  course,
  onSubmit,
}: {
  course?: AdminCourse;
  onSubmit: (input: ReturnType<typeof toCourseInput>) => Promise<unknown>;
}) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const directions = useQuery({ queryKey: ['admin', 'directions'], queryFn: directionsApi.list });
  const teachers = useQuery({ queryKey: ['admin', 'teachers'], queryFn: teachersApi.list });
  const templates = useQuery({
    queryKey: ['admin', 'certificate-templates'],
    queryFn: certificateTemplatesApi.list,
  });

  const form = useForm<CourseFormValues>({
    defaultValues: course ? fromCourse(course) : emptyCourseForm,
    resolver: mappedZodResolver(courseInputSchema, toCourseInput, courseFieldFor),
  });
  const { register, control, watch, setValue, formState } = form;
  const isFree = watch('isFree');
  const err = (k: keyof CourseFormValues) =>
    vmsg(formState.errors[k]?.message as string | undefined);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(toCourseInput(values));
    } catch (e) {
      toast.error(errMsg(e));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Section title={t('courses.tabs.general')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('courses.fields.title')} error={err('title')}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!formState.errors.title}
                {...register('title', {
                  onBlur: (e) => {
                    if (!form.getValues('slug')) setValue('slug', slugify(e.target.value));
                  },
                })}
              />
            )}
          </Field>
          <Field
            label={t('courses.fields.slug')}
            hint={t('courses.fields.slugHint')}
            error={err('slug')}
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!formState.errors.slug}
                {...register('slug')}
              />
            )}
          </Field>
          <Field
            label={t('courses.fields.shortDescription')}
            error={err('shortDescription')}
            className="md:col-span-2"
          >
            {(id, d) => (
              <Textarea id={id} aria-describedby={d} rows={2} {...register('shortDescription')} />
            )}
          </Field>
          <div className="grid gap-1.5 md:col-span-2">
            <span className="text-sm font-medium">{t('courses.fields.description')}</span>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  label={t('courses.fields.description')}
                />
              )}
            />
          </div>
          <Field
            label={t('courses.fields.goals')}
            hint={t('courses.fields.goalsHint')}
            error={err('goalsText')}
            className="md:col-span-2"
          >
            {(id, d) => (
              <Textarea id={id} aria-describedby={d} rows={4} {...register('goalsText')} />
            )}
          </Field>
          <Controller
            control={control}
            name="coverImageUrl"
            render={({ field }) => (
              <FileUploadField
                label={t('courses.fields.coverImage')}
                image
                purpose="course-cover"
                value={field.value}
                onChange={(u) => field.onChange(u ?? '')}
              />
            )}
          />
          <Field
            label={t('courses.fields.introVideo')}
            hint={t('courses.fields.introVideoHint')}
            error={err('introVideoUrl')}
          >
            {(id, d) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=..."
                aria-describedby={d}
                aria-invalid={!!formState.errors.introVideoUrl}
                {...register('introVideoUrl')}
              />
            )}
          </Field>
          <Field label={t('courses.fields.level')}>
            {(id) => (
              <NativeSelect id={id} {...register('level')}>
                {Object.values(CourseLevel).map((l) => (
                  <option key={l} value={l}>
                    {t(`courses.levels.${l}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>
      </Section>

      <Section title={t('courses.fields.price_column')}>
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxField
            label={t('courses.fields.isFree')}
            {...register('isFree', {
              onChange: (e: { target: { checked: boolean } }) => {
                if (e.target.checked) setValue('priceSom', '');
              },
            })}
          />
          <Field
            label={t('courses.fields.price')}
            hint={t('courses.fields.priceHint')}
            error={err('priceSom')}
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                inputMode="numeric"
                disabled={isFree}
                aria-invalid={!!formState.errors.priceSom}
                {...register('priceSom')}
              />
            )}
          </Field>
          <CheckboxField
            className="md:col-span-2"
            label={t('courses.fields.sequentialUnlock')}
            hint={t('courses.fields.sequentialUnlockHint')}
            {...register('sequentialUnlock')}
          />
        </div>
      </Section>

      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('courses.fields.direction')}>
            {(id) => (
              <NativeSelect id={id} {...register('directionId')}>
                <option value="">{t('common.none')}</option>
                {(directions.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('courses.fields.certificateTemplate')}>
            {(id) => (
              <NativeSelect id={id} {...register('certificateTemplateId')}>
                <option value="">{t('courses.fields.defaultTemplate')}</option>
                {(templates.data ?? []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="mb-1 text-sm font-medium">{t('courses.fields.teachers')}</legend>
            <Controller
              control={control}
              name="teacherIds"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(teachers.data ?? []).map((tch) => (
                    <CheckboxField
                      key={tch.id}
                      label={tch.fullName}
                      checked={field.value.includes(tch.id)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, tch.id]
                            : field.value.filter((x) => x !== tch.id),
                        )
                      }
                    />
                  ))}
                  {teachers.data?.length === 0 && (
                    <p className="text-muted-foreground text-sm">{t('common.empty')}</p>
                  )}
                </div>
              )}
            />
          </fieldset>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {course ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}
