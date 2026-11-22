'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { OtpPurpose } from '@onlinedars/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { postOtpRequest } from '@/lib/api/auth';
import { register as registerAccount, roleHome, safeNextPath } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Field,
  FormAlert,
  PasswordField,
  useApiErrorMessage,
  useCountdown,
  useFieldMessage,
} from './form-bits';
import { emailRegisterFormSchema, otpFormSchema, phoneRegisterFormSchema } from './schemas';

type Mode = 'email' | 'phone';
type PhoneDetails = z.output<typeof phoneRegisterFormSchema>;

function useAfterAuth() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  return {
    next,
    go: (role: Parameters<typeof roleHome>[0]) => {
      router.replace(next ?? roleHome(role));
      router.refresh();
    },
  };
}

function EmailRegister() {
  const t = useTranslations('auth');
  const fieldMessage = useFieldMessage();
  const apiMessage = useApiErrorMessage();
  const { go } = useAfterAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(emailRegisterFormSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await registerAccount(values);
      go(user.role);
    } catch (e) {
      setError(apiMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <Field
        id="fullName"
        label={t('fullName')}
        autoComplete="name"
        error={fieldMessage(errors.fullName?.message)}
        {...register('fullName')}
      />
      <Field
        id="email"
        type="email"
        label={t('email')}
        autoComplete="email"
        error={fieldMessage(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        id="password"
        label={t('password')}
        autoComplete="new-password"
        hint={t('passwordHint')}
        error={fieldMessage(errors.password?.message)}
        {...register('password')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {t('submitRegister')}
      </Button>
    </form>
  );
}

function PhoneRegister() {
  const t = useTranslations('auth');
  const fieldMessage = useFieldMessage();
  const apiMessage = useApiErrorMessage();
  const { go } = useAfterAuth();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<PhoneDetails | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const resendIn = useCountdown(resendAt);

  const detailsForm = useForm({
    resolver: zodResolver(phoneRegisterFormSchema),
    defaultValues: { fullName: '', phone: '', password: '' },
  });
  const otpForm = useForm({ resolver: zodResolver(otpFormSchema), defaultValues: { code: '' } });

  async function sendCode(phone: string): Promise<boolean> {
    setError(null);
    try {
      const r = await postOtpRequest({ phone, purpose: OtpPurpose.REGISTER });
      setResendAt(Date.now() + r.resendIn * 1000);
      return true;
    } catch (e) {
      setError(apiMessage(e));
      return false;
    }
  }

  const onDetails = detailsForm.handleSubmit(async (values) => {
    if (await sendCode(values.phone)) setDetails(values);
  });

  const onVerify = otpForm.handleSubmit(async ({ code }) => {
    if (!details) return;
    setError(null);
    try {
      const user = await registerAccount({ ...details, otpCode: code });
      go(user.role);
    } catch (e) {
      setError(apiMessage(e));
    }
  });

  if (details) {
    return (
      <form onSubmit={onVerify} noValidate className="grid gap-4" aria-label={t('otpTitle')}>
        <div>
          <h2 className="font-semibold">{t('otpTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('otpSent', { phone: details.phone })}</p>
        </div>
        <FormAlert>{error}</FormAlert>
        <Field
          id="otpCode"
          label={t('otpCode')}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-mono text-lg tracking-[0.4em]"
          error={fieldMessage(otpForm.formState.errors.code?.message)}
          {...otpForm.register('code')}
        />
        <Button type="submit" disabled={otpForm.formState.isSubmitting}>
          {t('submitVerify')}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => {
              setDetails(null);
              setError(null);
            }}
          >
            {t('changePhone')}
          </button>
          <button
            type="button"
            className="text-primary disabled:text-muted-foreground hover:underline disabled:no-underline"
            disabled={resendIn > 0}
            onClick={() => void sendCode(details.phone)}
          >
            {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resendCode')}
          </button>
        </div>
      </form>
    );
  }

  const { errors, isSubmitting } = detailsForm.formState;
  return (
    <form onSubmit={onDetails} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <Field
        id="fullName"
        label={t('fullName')}
        autoComplete="name"
        error={fieldMessage(errors.fullName?.message)}
        {...detailsForm.register('fullName')}
      />
      <Field
        id="phone"
        type="tel"
        label={t('phone')}
        placeholder={t('phonePlaceholder')}
        autoComplete="tel"
        error={fieldMessage(errors.phone?.message)}
        {...detailsForm.register('phone')}
      />
      <PasswordField
        id="password"
        label={t('password')}
        autoComplete="new-password"
        hint={t('passwordHint')}
        error={fieldMessage(errors.password?.message)}
        {...detailsForm.register('password')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {t('sendCode')}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<Mode>('phone');
  const next = safeNextPath(useSearchParams().get('next'));
  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={cn(
        'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-4">
      <div className="bg-muted flex gap-1 rounded-lg p-1">
        {tab('phone', t('byPhone'))}
        {tab('email', t('byEmail'))}
      </div>
      {mode === 'phone' ? <PhoneRegister /> : <EmailRegister />}
      <p className="text-muted-foreground text-center text-sm">
        {t('haveAccount')}{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="text-primary font-medium hover:underline"
        >
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
