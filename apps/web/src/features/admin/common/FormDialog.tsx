'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { type DefaultValues, type FieldValues, type UseFormReturn, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApiErrorMessage } from './useApiErrorMessage';
import { mappedZodResolver } from './zodResolver';

/**
 * Dialog with a react-hook-form validated by a shared zod schema. `toInput` maps form values to the
 * API body; `onSubmit` receives that body. Closes on success.
 */
export function FormDialog<TForm extends FieldValues, TInput>({
  open,
  onOpenChange,
  title,
  schema,
  defaultValues,
  toInput,
  onSubmit,
  submitLabel,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  schema: z.ZodType;
  defaultValues: DefaultValues<TForm>;
  toInput: (v: TForm) => TInput;
  onSubmit: (input: TInput) => Promise<unknown>;
  submitLabel?: string;
  children: (form: UseFormReturn<TForm>) => ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <Inner
          title={title}
          schema={schema}
          defaultValues={defaultValues}
          toInput={toInput}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
          onDone={() => onOpenChange(false)}
          wide={wide}
        >
          {children}
        </Inner>
      )}
    </Dialog>
  );
}

function Inner<TForm extends FieldValues, TInput>({
  title,
  schema,
  defaultValues,
  toInput,
  onSubmit,
  submitLabel,
  onDone,
  children,
  wide,
}: {
  title: ReactNode;
  schema: z.ZodType;
  defaultValues: DefaultValues<TForm>;
  toInput: (v: TForm) => TInput;
  onSubmit: (input: TInput) => Promise<unknown>;
  submitLabel?: string;
  onDone: () => void;
  children: (form: UseFormReturn<TForm>) => ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  const [form] = useState(() => ({ defaultValues }));
  const f = useForm<TForm>({ defaultValues: form.defaultValues, resolver: mappedZodResolver(schema, toInput) });
  return (
    <DialogContent closeLabel={t('close')} className={wide ? 'sm:max-w-2xl' : undefined}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={f.handleSubmit(async (v) => {
          try {
            await onSubmit(toInput(v));
            onDone();
          } catch (e) {
            toast.error(errMsg(e));
          }
        })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5">{children(f)}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={f.formState.isSubmitting}>
            {f.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitLabel ?? t('save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
