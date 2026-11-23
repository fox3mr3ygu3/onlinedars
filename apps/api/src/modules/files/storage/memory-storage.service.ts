import { assertValidKey, StorageService, type StoredObject } from './storage.service';

/** In-memory storage for tests. */
export class MemoryStorageService extends StorageService {
  readonly driver = 'memory' as const;
  readonly objects = new Map<string, StoredObject>();

  constructor(private readonly baseUrl = 'http://localhost:4000/api/v1/files') {
    super();
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertValidKey(key);
    this.objects.set(key, { body: Buffer.from(body), contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    assertValidKey(key);
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    this.objects.delete(key);
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key.replace(/^uploads\//, '')}`;
  }
}
