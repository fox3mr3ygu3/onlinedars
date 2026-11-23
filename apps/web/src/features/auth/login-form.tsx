'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@onlinedars/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { login, roleHome, safeNextPath, useSession } from '@/lib/auth';
import { Field, FormAlert, PasswordField, useApiErrorMessage, useFieldMessage } from './form-bits';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const fieldMessage = useFieldMessage();
  const apiMessage = useApiErrorMessage();
  const { user } = useSession();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  });

  // Already signed in (e.g. opened /login in a new tab): go straight on.
  useEffect(() => {
    if (user) router.replace(next ?? roleHome(user.role));
  }, [user, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const u = await login(values);
      // No router.refresh() here: it re-renders /login and cancels this navigation.
      router.replace(next ?? roleHome(u.role));
    } catch (e) {
      setError(apiMessage(e));
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <Field
        id="login"
        label={t('loginPlaceholder')}
        autoComplete="username"
        inputMode="email"
        hint={t('loginHint')}
        error={fieldMessage(errors.login?.message)}
        {...register('login')}
      />
      <PasswordField
        id="password"
        label={t('password')}
        autoComplete="current-password"
        error={fieldMessage(errors.password?.message)}
        {...register('password')}
      />
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-primary text-sm hover:underline">
          {t('forgotLink')}
        </Link>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {t('submitLogin')}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        {t('noAccount')}{' '}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="text-primary font-medium hover:underline"
        >
          {t('registerLink')}
        </Link>
      </p>
    </form>
  );
}
