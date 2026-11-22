'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AuthUser,
  changePasswordSchema,
  emailSchema,
  fullNameSchema,
} from '@onlinedars/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { meApi } from '@/lib/api/me';
import { qk } from '../cabinet/routes';
import { formatDate, PageHeader, QueryBoundary, useErrorMessage } from '../cabinet/ui';
import { useMe } from './useMe';

/** Form schema: empty email means "remove email" (null), as in `updateProfileSchema`. */
export const profileFormSchema = z.object({
  fullName: fullNameSchema,
  email: z.union([z.literal(''), emailSchema]),
});
type ProfileForm = z.infer<typeof profileFormSchema>;
type PasswordForm = z.infer<typeof changePasswordSchema>;

/** Only send changed fields; `''` email → null. */
export function profilePatch(user: AuthUser, v: ProfileForm) {
  const patch: { fullName?: string; email?: string | null } = {};
  if (v.fullName.trim() !== user.fullName) patch.fullName = v.fullName.trim();
  const email = v.email ? v.email : null;
  if (email !== user.email) patch.email = email;
  return patch;
}

/**
 * `FormMessage`'s `translate` prop intersects with the HTML `translate` attribute ("yes" | "no"),
 * so a function needs a cast. Requested a rename in docs/TASKS.md (architect).
 */
type MessageTranslate = ComponentProps<typeof FormMessage>['translate'];

function useTranslateValidation() {
  const t = useTranslations();
  return (key: string) =>
    key.startsWith('validation.') ? t(key as 'validation.required') : t('validation.required');
}

export function ProfileScreen() {
  const t = useTranslations('profile');
  const me = useMe();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('title')} />
      <QueryBoundary query={me}>
        {(user) => (
          <div className="space-y-6">
            <ProfileSummary user={user} />
            <ProfileForm user={user} />
            <PasswordFormCard />
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function ProfileSummary({ user }: { user: AuthUser }) {
  const t = useTranslations('profile');
  return (
    <section className="bg-card flex items-center gap-4 rounded-xl border p-5">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
      ) : (
        <div
          className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full text-xl font-semibold"
          aria-hidden="true"
        >
          {user.fullName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <dl className="min-w-0 space-y-0.5 text-sm">
        <dt className="sr-only">{t('fullName')}</dt>
        <dd className="text-lg font-semibold">{user.fullName}</dd>
        <dt className="sr-only">{t('phone')}</dt>
        <dd>
          {user.phone ?? t('notSet')}
          {user.phone ? (
            <span className="text-muted-foreground">
              {' '}
              · {user.phoneVerified ? t('phoneVerified') : t('phoneNotVerified')}
            </span>
          ) : null}
        </dd>
        <dt className="sr-only">{t('email')}</dt>
        <dd>{user.email ?? t('notSet')}</dd>
        <dd className="text-muted-foreground text-xs">
          {t('memberSince', { date: formatDate(user.createdAt) })}
        </dd>
      </dl>
    </section>
  );
}

function ProfileForm({ user }: { user: AuthUser }) {
  const t = useTranslations('profile');
  const tv = useTranslateValidation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: user.fullName, email: user.email ?? '' },
  });

  const save = useMutation({
    mutationFn: meApi.updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.me, updated);
      form.reset({ fullName: updated.fullName, email: updated.email ?? '' });
      toast.success(t('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="mb-4 font-semibold">{t('edit')}</h2>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => {
            const patch = profilePatch(user, v);
            if (Object.keys(patch).length === 0) return;
            save.mutate(patch);
          })}
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fullName')}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage translate={tv as MessageTranslate} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage translate={tv as MessageTranslate} />
              </FormItem>
            )}
          />
          <div className="grid gap-2">
            <Label htmlFor="profile-phone">{t('phone')}</Label>
            <Input
              id="profile-phone"
              value={user.phone ?? ''}
              disabled
              readOnly
              aria-describedby="profile-phone-hint"
            />
            <p id="profile-phone-hint" className="text-muted-foreground text-sm">
              {t('phoneHint')}
            </p>
          </div>
          <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
            {save.isPending ? t('saving') : t('save')}
          </Button>
        </form>
      </Form>
    </section>
  );
}

function PasswordFormCard() {
  const t = useTranslations('profile');
  const tv = useTranslateValidation();
  const errorMessage = useErrorMessage();
  const form = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const change = useMutation({
    mutationFn: meApi.changePassword,
    onSuccess: () => {
      form.reset();
      toast.success(t('passwordChanged'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="mb-4 font-semibold">{t('changePassword')}</h2>
      <Form {...form}>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => change.mutate(v))}
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('currentPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage translate={tv as MessageTranslate} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('newPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage translate={tv as MessageTranslate} />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? t('saving') : t('changePassword')}
          </Button>
        </form>
      </Form>
    </section>
  );
}
