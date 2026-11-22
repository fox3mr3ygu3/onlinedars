/**
 * File uploads (backend-content): POST /admin/files (multipart/form-data, field `file`,
 * optional field `purpose`). Limits are enforced on the server; the web may use them to
 * pre-check before uploading.
 */
import { z } from 'zod';

export const MB = 1024 * 1024;

export const UploadPurpose = {
  /** Lesson images, question images, course covers, teacher photos. */
  IMAGE: 'IMAGE',
  /** Downloadable lesson files (PDF, Office, archives, text). */
  FILE: 'FILE',
} as const;
export type UploadPurpose = (typeof UploadPurpose)[keyof typeof UploadPurpose];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const FILE_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
] as const;

/** Max bytes per purpose. */
export const UPLOAD_MAX_BYTES: Record<UploadPurpose, number> = {
  IMAGE: 5 * MB,
  FILE: 50 * MB,
};

export const UPLOAD_ALLOWED_MIME: Record<UploadPurpose, readonly string[]> = {
  IMAGE: IMAGE_MIME_TYPES,
  FILE: FILE_MIME_TYPES,
};

export const uploadFieldsSchema = z.object({
  purpose: z.enum(UploadPurpose).default(UploadPurpose.FILE),
});
export type UploadFields = z.infer<typeof uploadFieldsSchema>;

/** Response of POST /admin/files. `id` is the storage key; store `url` (and `key`) on the entity. */
export const uploadedFileSchema = z.object({
  id: z.string(),
  key: z.string(),
  url: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  originalName: z.string(),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema>;
