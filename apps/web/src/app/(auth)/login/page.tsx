import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { LoginForm } from '@/features/auth/login-form';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('loginTitle') };
}

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('loginTitle')} subtitle={t('loginSubtitle')}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
