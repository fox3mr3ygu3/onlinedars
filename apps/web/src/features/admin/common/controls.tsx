'use client';

import { Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadFile } from '@/lib/api/admin/content';
import type { UploadedFile } from '@/lib/api/admin/types';
import { useApiErrorMessage } from './useApiErrorMessage';

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const t = useTranslations('admin.common');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"
      aria-label="pagination"
    >
      <span className="text-muted-foreground">{t('totalCount', { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('prev')}
        </Button>
        <span>{t('pageOf', { page, pages })}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </nav>
  );
}

/** Button that asks for confirmation in a dialog before running `onConfirm`. */
export function ConfirmButton({
  children,
  message,
  onConfirm,
  variant = 'destructive',
  size = 'sm',
  disabled,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  message?: ReactNode;
  onConfirm: () => Promise<unknown> | unknown;
  variant?: 'destructive' | 'outline' | 'ghost' | 'default';
  size?: 'sm' | 'default' | 'icon';
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const t = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('confirm')}</DialogTitle>
            <DialogDescription>{message ?? t('confirmDelete')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button
              variant={variant === 'default' ? 'default' : 'destructive'}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (e) {
                  toast.error(errMsg(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Uploads a file via POST /admin/files and returns its URL. Shows an image preview for images.
 * `accept` limits the picker; the API enforces type/size limits.
 */
export function FileUploadField({
  label,
  value,
  onChange,
  accept,
  image,
  purpose,
  onUploaded,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  accept?: string;
  image?: boolean;
  purpose?: string;
  onUploaded?: (f: UploadedFile) => void;
}) {
  const t = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded files live on another origin
            <img src={value} alt="" className="h-20 w-auto max-w-40 rounded border object-cover" />
          ) : (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex max-w-full items-center gap-1 truncate text-sm underline"
            >
              <Paperclip className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{value.split('/').pop()}</span>
            </a>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <X aria-hidden />
            {t('removeFile')}
          </Button>
        </div>
      ) : null}
      <div>
        <input
          ref={input}
          type="file"
          accept={accept ?? (image ? 'image/*' : undefined)}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            try {
              const up = await uploadFile(file, purpose);
              onChange(up.url);
              onUploaded?.(up);
              toast.success(t('uploaded'));
            } catch (err) {
              toast.error(errMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {busy ? t('uploading') : t('upload')}
        </Button>
      </div>
    </div>
  );
}

export function DeleteIconButton({
  label,
  onConfirm,
  message,
}: {
  label: string;
  onConfirm: () => Promise<unknown>;
  message?: ReactNode;
}) {
  return (
    <ConfirmButton
      size="icon"
      variant="ghost"
      aria-label={label}
      onConfirm={onConfirm}
      message={message}
    >
      <Trash2 className="text-destructive" aria-hidden />
    </ConfirmButton>
  );
}
