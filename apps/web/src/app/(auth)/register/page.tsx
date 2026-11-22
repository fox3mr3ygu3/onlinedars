import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { RegisterForm } from '@/features/auth/register-form';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('registerTitle') };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('registerTitle')} subtitle={t('registerSubtitle')}>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
