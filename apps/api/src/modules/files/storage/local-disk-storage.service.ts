import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { assertValidKey, StorageService, type StoredObject } from './storage.service';

/**
 * Stores uploads on the local disk (dev without MinIO). Objects are served by the public
 * `GET /api/v1/files/:year/:month/:name` route; the content type is kept in a sidecar file.
 */
export class LocalDiskStorageService extends StorageService {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(
    root: string,
    /** e.g. http://localhost:4000/api/v1/files */
    private readonly baseUrl: string,
  ) {
    super();
    this.root = resolve(root);
  }

  private pathOf(key: string): string {
    assertValidKey(key);
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + sep)) throw new Error('Path escapes storage root');
    return p;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const p = this.pathOf(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    await writeFile(`${p}.type`, contentType, 'utf8');
  }

  async get(key: string): Promise<StoredObject | null> {
    const p = this.pathOf(key);
    try {
      const [body, contentType] = await Promise.all([
        readFile(p),
        readFile(`${p}.type`, 'utf8').catch(() => 'application/octet-stream'),
      ]);
      return { body, contentType };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    const p = this.pathOf(key);
    await rm(p, { force: true });
    await rm(`${p}.type`, { force: true });
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key.replace(/^uploads\//, '')}`;
  }
}
