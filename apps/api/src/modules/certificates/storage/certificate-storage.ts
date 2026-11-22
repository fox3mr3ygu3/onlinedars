/**
 * Minimal object storage used for certificate PDFs.
 *
 * NOTE for the coordinator: backend-content builds the platform `StorageService` in
 * `modules/files`. Until that lands, certificates use this small interface with its own S3
 * implementation. To unify, provide `CertificateStorage` with an adapter over StorageService
 * (put/get by key) in CertificatesModule — nothing else in this module needs to change.
 */
export abstract class CertificateStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
}

/** In-memory storage for tests and local runs without MinIO. */
export class MemoryCertificateStorage extends CertificateStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<Buffer> {
    const o = this.objects.get(key);
    if (!o) throw new Error(`Object not found: ${key}`);
    return o.body;
  }
}

export const certificatePdfKey = (publicId: string) => `certificates/${publicId}.pdf`;
