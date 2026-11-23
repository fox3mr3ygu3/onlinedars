'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSettings, updateSettings } from '@/lib/api/admin/management';
import type { AdminSettings } from '@/lib/api/admin/types';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import {
  CheckboxField,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Section,
  Textarea,
} from '../common/ui';

/** Known keys get a typed field; everything else is editable as JSON. Key names are agreed with backend-content. */
const KNOWN = {
  platformName: 'text',
  supportPhone: 'text',
  supportEmail: 'text',
  supportTelegram: 'text',
  certificateVerifyBaseUrl: 'text',
  refundPolicyDays: 'number',
  maintenanceMode: 'boolean',
} as const;
type KnownKey = keyof typeof KNOWN;

export function splitSettings(s: AdminSettings): {
  known: Partial<Record<KnownKey, unknown>>;
  other: AdminSettings;
} {
  const known: Partial<Record<KnownKey, unknown>> = {};
  const other: AdminSettings = {};
  for (const [k, v] of Object.entries(s)) {
    if (k in KNOWN) known[k as KnownKey] = v;
    else other[k] = v;
  }
  return { known, other };
}

export function SettingsPage() {
  const t = useTranslations('admin.settings');
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: getSettings });
  return (
    <>
      <PageHeader title={t('title')} />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <SettingsForm initial={q.data} />
      )}
    </>
  );
}

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const { known, other } = splitSettings(initial);
  const [values, setValues] = useState<Partial<Record<KnownKey, unknown>>>(known);
  const [json, setJson] = useState(() => JSON.stringify(other, null, 2));
  const [jsonError, setJsonError] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    let extra: AdminSettings;
    try {
      extra = json.trim() ? (JSON.parse(json) as AdminSettings) : {};
      if (typeof extra !== 'object' || extra === null || Array.isArray(extra))
        throw new Error('not an object');
    } catch {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    setBusy(true);
    try {
      const saved = await updateSettings({ ...extra, ...values });
      qc.setQueryData(['admin', 'settings'], saved);
      toast.success(t('settings.saved'));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Section title={t('settings.general')}>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(KNOWN) as KnownKey[]).map((k) =>
            KNOWN[k] === 'boolean' ? (
              <CheckboxField
                key={k}
                label={t(`settings.fields.${k}`)}
                checked={Boolean(values[k])}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.checked }))}
              />
            ) : (
              <Field key={k} label={t(`settings.fields.${k}`)}>
                {(id) => (
                  <Input
                    id={id}
                    type={KNOWN[k] === 'number' ? 'number' : 'text'}
                    value={values[k] == null ? '' : String(values[k])}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [k]:
                          KNOWN[k] === 'number'
                            ? e.target.value === ''
                              ? null
                              : Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                  />
                )}
              </Field>
            ),
          )}
        </div>
      </Section>
      <Section title={t('settings.other')}>
        <Field
          label={t('settings.otherHint')}
          error={jsonError ? t('settings.invalidJson') : undefined}
        >
          {(id) => (
            <Textarea
              id={id}
              spellCheck={false}
              className="min-h-48 font-mono text-xs"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          )}
        </Field>
      </Section>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
