'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { postForgotPassword, postResetPassword } from '@/lib/api/auth';
import { clearSession } from '@/lib/auth';
import { Field, FormAlert, PasswordField, useApiErrorMessage, useFieldMessage } from './form-bits';
import { forgotFormSchema, resetFormSchema } from './schemas';

/** Two steps: send a code to the account's phone, then code + new password. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const fieldMessage = useFieldMessage();
  const apiMessage = useApiErrorMessage();
  const [login, setLogin] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestForm = useForm({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: { login: '' },
  });
  const resetForm = useForm({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { code: '', newPassword: '' },
  });

  const onRequest = requestForm.handleSubmit(async (values) => {
    setError(null);
    try {
      // Always 202 (no account enumeration): move on regardless of whether the account exists.
      await postForgotPassword(values);
      setLogin(values.login);
    } catch (e) {
      setError(apiMessage(e));
    }
  });

  const onReset = resetForm.handleSubmit(async ({ code, newPassword }) => {
    if (!login) return;
    setError(null);
    try {
      await postResetPassword({ login, code, newPassword });
      // The API revokes all sessions on reset.
      clearSession();
      setDone(true);
    } catch (e) {
      setError(apiMessage(e));
    }
  });

  if (done) {
    return (
      <div className="grid gap-4 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
        <p>{t('resetDone')}</p>
        <Button asChild>
          <Link href="/login">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  if (login) {
    const { errors, isSubmitting } = resetForm.formState;
    return (
      <form
        method="post"
        onSubmit={onReset}
        noValidate
        className="grid gap-4"
        aria-label={t('resetTitle')}
      >
        <div>
          <h2 className="font-semibold">{t('resetTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('resetSubtitle')}</p>
        </div>
        <FormAlert>{error}</FormAlert>
        <Field
          id="code"
          label={t('otpCode')}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-mono text-lg tracking-[0.4em]"
          error={fieldMessage(errors.code?.message)}
          {...resetForm.register('code')}
        />
        <PasswordField
          id="newPassword"
          label={t('newPassword')}
          autoComplete="new-password"
          hint={t('passwordHint')}
          error={fieldMessage(errors.newPassword?.message)}
          {...resetForm.register('newPassword')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {t('resetSubmit')}
        </Button>
      </form>
    );
  }

  const { errors, isSubmitting } = requestForm.formState;
  return (
    <form method="post" onSubmit={onRequest} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <Field
        id="login"
        label={t('loginPlaceholder')}
        autoComplete="username"
        hint={t('loginHint')}
        error={fieldMessage(errors.login?.message)}
        {...requestForm.register('login')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {t('forgotSubmit')}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
