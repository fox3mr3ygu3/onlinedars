import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../../../config/app-config';
import { CertificateStorage } from './certificate-storage';

/** S3 / MinIO implementation (path-style addressing for MinIO). Objects are private. */
export class S3CertificateStorage extends CertificateStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfig) {
    super();
    const env = config.env;
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      // MinIO ignores the region; SDK requires one.
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }
}
