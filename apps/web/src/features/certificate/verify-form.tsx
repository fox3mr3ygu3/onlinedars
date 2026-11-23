'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function VerifyForm({ initial = '' }: { initial?: string }) {
  const t = useTranslations('verify');
  const router = useRouter();
  const [code, setCode] = useState(initial);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (value) router.push(`/verify/${encodeURIComponent(value)}`);
  }

  return (
    <form action="/verify" method="get" onSubmit={onSubmit} className="grid gap-2">
      <Label htmlFor="certificate-code">{t('codeLabel')}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="certificate-code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('codePlaceholder')}
          maxLength={64}
          required
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit">{t('submit')}</Button>
      </div>
    </form>
  );
}
