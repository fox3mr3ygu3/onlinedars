'use client';

import {
  type LessonMaterialInput,
  LessonMaterialType,
  lessonMaterialInputSchema,
} from '@onlinedars/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Film, ImageIcon, Loader2, Paperclip, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from '@/lib/api/admin/content';
import type { AdminMaterial } from '@/lib/api/admin/types';
import { DeleteIconButton, FileUploadField } from '../common/controls';
import { byPosition } from '../common/reorder';
import { useApiErrorMessage, useValidationMessage } from '../common/useApiErrorMessage';
import { EmptyState, ErrorState, Field, LoadingState, NativeSelect, Section } from '../common/ui';
import { RichTextEditor } from './RichTextEditor';

const ICONS = {
  TEXT: FileText,
  IMAGE: ImageIcon,
  FILE: Paperclip,
  VIDEO: Film,
} as const;

type Draft = {
  type: LessonMaterialType;
  title: string;
  content: string;
  fileUrl: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number | null;
  videoUrl: string;
};

const emptyDraft: Draft = {
  type: LessonMaterialType.TEXT,
  title: '',
  content: '',
  fileUrl: '',
  fileKey: '',
  mimeType: '',
  sizeBytes: null,
  videoUrl: '',
};

/** Only the fields that belong to the chosen material type are sent. */
export function toMaterialInput(d: Draft): LessonMaterialInput {
  const file = d.type === LessonMaterialType.IMAGE || d.type === LessonMaterialType.FILE;
  return {
    type: d.type,
    title: d.title.trim() || null,
    content: d.type === LessonMaterialType.TEXT ? d.content : null,
    fileUrl: file ? d.fileUrl || null : null,
    fileKey: file ? d.fileKey || null : null,
    mimeType: file ? d.mimeType || null : null,
    sizeBytes: file ? d.sizeBytes : null,
    videoUrl: d.type === LessonMaterialType.VIDEO ? d.videoUrl.trim() || null : null,
  };
}

const fromMaterial = (m: AdminMaterial): Draft => ({
  type: m.type,
  title: m.title ?? '',
  content: m.content ?? '',
  fileUrl: m.fileUrl ?? '',
  fileKey: m.fileKey ?? '',
  mimeType: m.mimeType ?? '',
  sizeBytes: m.sizeBytes,
  videoUrl: m.videoUrl ?? '',
});

export function MaterialsEditor({ lessonId }: { lessonId: string }) {
  const t = useTranslations('admin');
  const qc = useQueryClient();
  const key = ['admin', 'materials', lessonId] as const;
  const q = useQuery({
    queryKey: key,
    queryFn: async () => byPosition(await listMaterials(lessonId)),
  });
  const [editing, setEditing] = useState<AdminMaterial | 'new' | null>(null);

  return (
    <Section
      title={t('lessons.materials.title')}
      actions={
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          {t('lessons.materials.add')}
        </Button>
      }
    >
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState>{t('lessons.materials.empty')}</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {q.data.map((m) => {
            const Icon = ICONS[m.type];
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-md border p-2">
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.title || t(`lessons.materials.types.${m.type}`)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {t(`lessons.materials.types.${m.type}`)}
                    {m.videoUrl
                      ? ` · ${m.videoUrl}`
                      : m.fileUrl
                        ? ` · ${m.fileUrl.split('/').pop()}`
                        : ''}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('common.edit')}
                  onClick={() => setEditing(m)}
                >
                  <Pencil aria-hidden />
                </Button>
                <DeleteIconButton
                  label={t('common.delete')}
                  onConfirm={async () => {
                    await deleteMaterial(m.id);
                    await qc.invalidateQueries({ queryKey: key });
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <MaterialDialog
            initial={editing === 'new' ? emptyDraft : fromMaterial(editing)}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') await createMaterial(lessonId, input);
              else await updateMaterial(editing.id, input);
              await qc.invalidateQueries({ queryKey: key });
              toast.success(t('lessons.materials.saved'));
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </Section>
  );
}

function MaterialDialog({
  initial,
  onSave,
  onCancel,
}: {
  initial: Draft;
  onSave: (input: LessonMaterialInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('admin');
  const vmsg = useValidationMessage();
  const errMsg = useApiErrorMessage();
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const submit = async () => {
    const parsed = lessonMaterialInputSchema.safeParse(toMaterialInput(d));
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSave(parsed.data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent closeLabel={t('common.close')} className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t('lessons.materials.add')}</DialogTitle>
      </DialogHeader>
      <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5">
        <Field label={t('lessons.materials.fields.type')}>
          {(id) => (
            <NativeSelect
              id={id}
              value={d.type}
              onChange={(e) => set({ type: e.target.value as LessonMaterialType })}
            >
              {Object.values(LessonMaterialType).map((ty) => (
                <option key={ty} value={ty}>
                  {t(`lessons.materials.types.${ty}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label={t('lessons.materials.fields.title')} error={vmsg(errors.title)}>
          {(id) => (
            <Input id={id} value={d.title} onChange={(e) => set({ title: e.target.value })} />
          )}
        </Field>
        {d.type === LessonMaterialType.TEXT && (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t('lessons.materials.fields.content')}</span>
            <RichTextEditor
              value={d.content}
              onChange={(content) => set({ content })}
              label={t('lessons.materials.fields.content')}
              invalid={!!errors.content}
            />
            {errors.content && (
              <p role="alert" className="text-destructive text-sm">
                {vmsg(errors.content)}
              </p>
            )}
          </div>
        )}
        {(d.type === LessonMaterialType.IMAGE || d.type === LessonMaterialType.FILE) && (
          <div className="grid gap-1">
            <FileUploadField
              label={t(
                d.type === LessonMaterialType.IMAGE
                  ? 'lessons.materials.fields.image'
                  : 'lessons.materials.fields.file',
              )}
              image={d.type === LessonMaterialType.IMAGE}
              purpose="lesson-material"
              value={d.fileUrl}
              onChange={(u) =>
                set({
                  fileUrl: u ?? '',
                  ...(u ? {} : { fileKey: '', mimeType: '', sizeBytes: null }),
                })
              }
              onUploaded={(f) =>
                set({
                  fileUrl: f.url,
                  fileKey: f.key,
                  mimeType: f.mimeType,
                  sizeBytes: f.sizeBytes,
                })
              }
            />
            {errors.fileUrl && (
              <p role="alert" className="text-destructive text-sm">
                {vmsg(errors.fileUrl)}
              </p>
            )}
          </div>
        )}
        {d.type === LessonMaterialType.VIDEO && (
          <Field label={t('lessons.materials.fields.videoUrl')} error={vmsg(errors.videoUrl)}>
            {(id) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={d.videoUrl}
                onChange={(e) => set({ videoUrl: e.target.value })}
              />
            )}
          </Field>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t('common.save')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
