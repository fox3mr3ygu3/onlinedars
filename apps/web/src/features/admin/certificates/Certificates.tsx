'use client';

import { certificateTemplateInputSchema, certificateVerifyPath } from '@onlinedars/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { certificateTemplatesApi } from '@/lib/api/admin/management';
import type { AdminCertificateTemplate } from '@/lib/api/admin/types';
import { ConfirmButton, FileUploadField } from '../common/controls';
import { formatDate } from '../common/format';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  CheckboxField,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Section,
  TableWrap,
  Textarea,
} from '../common/ui';
import {
  CERTIFICATE_PLACEHOLDERS,
  DEFAULT_CERTIFICATE_HTML,
  missingPlaceholders,
  renderCertificatePreview,
} from './preview';

const KEY = ['admin', 'certificate-templates'] as const;

export function CertificateTemplatesList() {
  const t = useTranslations('admin');
  const q = useQuery({ queryKey: KEY, queryFn: certificateTemplatesApi.list });
  return (
    <>
      <PageHeader
        title={t('certificates.title')}
        actions={
          <Button asChild>
            <Link href="/admin/certificates/new">
              <Plus aria-hidden />
              {t('certificates.new')}
            </Link>
          </Button>
        }
      />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>{t('certificates.fields.name')}</th>
              <th>{t('courses.fields.updatedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  <Link
                    href={`/admin/certificates/${tpl.id}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {tpl.name}
                  </Link>{' '}
                  {tpl.isDefault && <Badge tone="success">{t('certificates.default')}</Badge>}
                </td>
                <td>{formatDate(tpl.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

export function CertificateTemplateEditor({ templateId }: { templateId?: string }) {
  const t = useTranslations('admin');
  const q = useQuery({
    queryKey: [...KEY, templateId],
    queryFn: () => certificateTemplatesApi.get(templateId as string),
    enabled: !!templateId,
  });
  if (templateId && q.isPending) return <LoadingState />;
  if (templateId && q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader
        title={templateId ? t('certificates.editTitle') : t('certificates.new')}
        back={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/certificates">
              <ArrowLeft aria-hidden />
              {t('certificates.title')}
            </Link>
          </Button>
        }
      />
      <TemplateForm key={q.data?.id ?? 'new'} template={q.data} />
    </>
  );
}

function TemplateForm({ template }: { template?: AdminCertificateTemplate }) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? '');
  const [html, setHtml] = useState(template?.html ?? DEFAULT_CERTIFICATE_HTML);
  const [bg, setBg] = useState(template?.backgroundImageUrl ?? '');
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const deferredHtml = useDeferredValue(html);

  const sample = useMemo(
    () => ({
      fullName: t('certificates.sample.fullName'),
      courseTitle: t('certificates.sample.courseTitle'),
      issueDate: formatDate(new Date().toISOString()),
      certificateId: t('certificates.sample.certificateId'),
      verifyUrl: certificateVerifyPath(t('certificates.sample.certificateId')),
      backgroundImageUrl: bg,
    }),
    [t, bg],
  );
  const preview = useMemo(
    () => renderCertificatePreview(deferredHtml, sample),
    [deferredHtml, sample],
  );
  const missing = missingPlaceholders(html);

  const save = async () => {
    const parsed = certificateTemplateInputSchema.safeParse({
      name: name.trim(),
      html,
      backgroundImageUrl: bg || null,
      isDefault,
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (template) {
        await certificateTemplatesApi.update(template.id, parsed.data);
        toast.success(t('common.saved'));
      } else {
        const created = await certificateTemplatesApi.create(parsed.data);
        toast.success(t('certificates.created'));
        router.push(`/admin/certificates/${created.id}`);
      }
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section>
        <div className="grid gap-4">
          <Field label={t('certificates.fields.name')} error={vmsg(errors.name)}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <FileUploadField
            label={t('certificates.fields.backgroundImage')}
            image
            purpose="certificate-background"
            value={bg}
            onChange={(u) => setBg(u ?? '')}
          />
          <CheckboxField
            label={t('certificates.fields.isDefault')}
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <div className="grid gap-1">
            <p className="text-sm font-medium">{t('certificates.placeholders')}</p>
            <p className="text-muted-foreground text-xs">{t('certificates.placeholdersHint')}</p>
            <div className="flex flex-wrap gap-1">
              {CERTIFICATE_PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="bg-muted hover:bg-accent rounded px-2 py-0.5 font-mono text-xs"
                  onClick={() => void navigator.clipboard?.writeText(`{{${p}}}`)}
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>
          <Field label={t('certificates.fields.html')} error={vmsg(errors.html)}>
            {(id) => (
              <Textarea
                id={id}
                spellCheck={false}
                className="min-h-96 font-mono text-xs"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
              />
            )}
          </Field>
          {missing.length > 0 && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
              {t('certificates.missing', { list: missing.map((m) => `{{${m}}}`).join(', ') })}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {template && (
              <ConfirmButton
                onConfirm={async () => {
                  await certificateTemplatesApi.remove(template.id);
                  await qc.invalidateQueries({ queryKey: KEY });
                  router.push('/admin/certificates');
                }}
              >
                {t('common.delete')}
              </ConfirmButton>
            )}
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Section>
      <Section title={t('certificates.preview')} className="xl:sticky xl:top-6 xl:self-start">
        {/* sandbox without allow-scripts: template HTML can't run JS in the admin's origin */}
        <div className="overflow-hidden rounded border bg-white">
          <iframe
            title={t('certificates.preview')}
            sandbox=""
            srcDoc={preview}
            className="aspect-[297/210] w-full"
            data-testid="certificate-preview"
          />
        </div>
      </Section>
    </div>
  );
}
