import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BYTES,
  type UploadedFile,
  type UploadPurpose,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from './storage/storage.service';

/** The subset of a multer file we use (avoids depending on @types/multer). */
export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/**
 * Checks the file's magic bytes against its declared MIME type, so e.g. an HTML page renamed
 * to .png is rejected. Returns true when the content matches.
 */
export function contentMatchesMime(buf: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      return startsWith(buf, [0x47, 0x49, 0x46, 0x38]);
    case 'image/webp':
      return (
        startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case 'application/pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'text/plain':
    case 'text/csv': {
      const head = buf.subarray(0, 8192);
      return !head.includes(0) && !/<\s*(script|html|svg)/i.test(head.toString('utf8'));
    }
    default:
      return false;
  }
}

/** Multer decodes multipart filenames as latin1; recover UTF-8 and strip path parts. */
export function cleanFileName(name: string): string {
  let decoded = name;
  try {
    decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (decoded.includes('�')) decoded = name;
  } catch {
    decoded = name;
  }
  const base = decoded.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f"<>]/g, '').slice(0, 200) || 'file';
}

export function newStorageKey(ext: string, now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `uploads/${yyyy}/${mm}/${randomBytes(16).toString('hex')}.${ext}`;
}

@Injectable()
export class FilesService {
  constructor(private readonly storage: StorageService) {}

  /** Validates type (declared MIME + magic bytes) and size per purpose, then stores the file. */
  async upload(file: IncomingFile | undefined, purpose: UploadPurpose): Promise<UploadedFile> {
    if (!file || !file.buffer || file.size === 0) {
      throw AppException.badRequest(ErrorCode.FILE_REQUIRED);
    }
    const mime = file.mimetype.toLowerCase();
    const allowed = UPLOAD_ALLOWED_MIME[purpose];
    if (!allowed.includes(mime) || !contentMatchesMime(file.buffer, mime)) {
      throw AppException.badRequest(ErrorCode.FILE_TYPE_NOT_ALLOWED, `Not allowed: ${mime}`, {
        allowed,
      });
    }
    const max = UPLOAD_MAX_BYTES[purpose];
    if (file.size > max || file.buffer.length > max) {
      throw new AppException(ErrorCode.FILE_TOO_LARGE, 413, `Max ${max} bytes`, { maxBytes: max });
    }
    const key = newStorageKey(EXTENSION_BY_MIME[mime] ?? 'bin');
    await this.storage.put(key, file.buffer, mime);
    return {
      id: key,
      key,
      url: this.storage.publicUrl(key),
      mimeType: mime,
      sizeBytes: file.buffer.length,
      originalName: cleanFileName(file.originalname),
    };
  }

  /** For the local-disk driver's public file route. */
  read(key: string) {
    return this.storage.get(key);
  }

  get driver() {
    return this.storage.driver;
  }
}
