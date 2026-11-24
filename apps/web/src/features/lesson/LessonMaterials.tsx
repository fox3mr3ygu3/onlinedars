'use client';

import { LessonMaterialType } from '@onlinedars/shared';
import { Download, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonMaterialView } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { formatBytes, toEmbedUrl } from './content';
import { RichText } from './RichText';

function isSafeUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export function LessonMaterial({ material: m }: { material: LessonMaterialView }) {
  const t = useTranslations('lesson');
  switch (m.type) {
    case LessonMaterialType.TEXT:
      return m.content ? <RichText content={m.content} /> : null;
    case LessonMaterialType.IMAGE:
      return isSafeUrl(m.fileUrl) ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.fileUrl}
            alt={m.title ?? ''}
            className="w-full rounded-lg border"
            loading="lazy"
          />
          {m.title ? (
            <figcaption className="text-muted-foreground mt-2 text-sm">{m.title}</figcaption>
          ) : null}
        </figure>
      ) : null;
    case LessonMaterialType.FILE:
      return isSafeUrl(m.fileUrl) ? (
        <a
          href={m.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="hover:border-primary flex items-center gap-3 rounded-lg border p-3 transition-colors"
        >
          <FileText className="text-primary size-6 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{m.title ?? t('file')}</span>
            {m.sizeBytes ? (
              <span className="text-muted-foreground text-xs">{formatBytes(m.sizeBytes)}</span>
            ) : null}
          </span>
          <span className="text-primary inline-flex items-center gap-1 text-sm">
            <Download className="size-4" aria-hidden="true" />
            {t('download')}
          </span>
        </a>
      ) : null;
    case LessonMaterialType.VIDEO:
      return isSafeUrl(m.videoUrl) ? (
        <figure>
          <LessonVideo material={m} className="rounded-lg border" />
          {m.title ? (
            <figcaption className="text-muted-foreground mt-2 text-sm">{m.title}</figcaption>
          ) : null}
        </figure>
      ) : null;
    default:
      return null;
  }
}

/** True when the material is a playable video (used to lift it onto the player stage). */
export function isPlayableVideo(m: LessonMaterialView): boolean {
  return m.type === LessonMaterialType.VIDEO && isSafeUrl(m.videoUrl);
}

/** 16:9 video frame: YouTube/Vimeo as a privacy-friendly embed, anything else as <video>. */
export function LessonVideo({
  material: m,
  className,
}: {
  material: LessonMaterialView;
  className?: string;
}) {
  const t = useTranslations('lesson');
  if (!isSafeUrl(m.videoUrl)) return null;
  const embed = toEmbedUrl(m.videoUrl);
  return (
    <div className={cn('aspect-video overflow-hidden bg-black', className)}>
      {embed ? (
        <iframe
          src={embed}
          title={m.title ?? t('videoTitle')}
          className="size-full"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video
          src={m.videoUrl}
          controls
          preload="metadata"
          className="size-full"
          aria-label={m.title ?? t('videoTitle')}
        >
          {t('videoUnsupported')}
        </video>
      )}
    </div>
  );
}
