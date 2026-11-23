/**
 * Object storage abstraction. Implementations:
 * - S3StorageService (S3 / MinIO, used when S3 is configured)
 * - LocalDiskStorageService (dev without MinIO; files served by GET /files/...)
 * - MemoryStorageService (tests)
 * Inject `StorageService`; never depend on a concrete driver.
 */
export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export type StorageDriver = 's3' | 'local' | 'memory';

export abstract class StorageService {
  abstract readonly driver: StorageDriver;
  /** Stores `body` under `key` (overwrites). */
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Reads an object, or null if it does not exist. */
  abstract get(key: string): Promise<StoredObject | null>;
  /** Deletes an object; deleting a missing key is not an error. */
  abstract delete(key: string): Promise<void>;
  /** Public URL the browser can load the object from. */
  abstract publicUrl(key: string): string;
}

/** Keys look like `uploads/2026/11/<random>.<ext>` — validated before touching any driver. */
export const STORAGE_KEY_RE = /^uploads\/\d{4}\/\d{2}\/[a-z0-9]{16,64}\.[a-z0-9]{1,8}$/;

export function assertValidKey(key: string): void {
  if (!STORAGE_KEY_RE.test(key)) throw new Error(`Invalid storage key: ${key}`);
}
