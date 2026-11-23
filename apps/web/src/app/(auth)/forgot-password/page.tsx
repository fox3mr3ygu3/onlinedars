import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/features/auth/auth-card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('forgotTitle') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('forgotTitle')} subtitle={t('forgotSubtitle')}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
