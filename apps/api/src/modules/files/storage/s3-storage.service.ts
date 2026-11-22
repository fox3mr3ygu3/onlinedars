import { createHash, createHmac } from 'node:crypto';
import { assertValidKey, StorageService, type StoredObject } from './storage.service';

/**
 * Minimal S3 client (PutObject / GetObject / DeleteObject) with AWS Signature V4, path-style
 * URLs (MinIO-compatible). Hand-written to avoid pulling in the AWS SDK for three calls —
 * see docs/DECISIONS.md. Objects are read publicly via S3_PUBLIC_URL (public-read bucket policy
 * on the `uploads/` prefix, keys are unguessable).
 */
export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl?: string;
}

const sha256hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as S3 expects for each path segment. */
export function encodeSegment(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface SignInput {
  method: string;
  /** Already-encoded absolute path, e.g. /bucket/uploads/a.png */
  path: string;
  /** Lower-case header names → values; must include host, x-amz-date, x-amz-content-sha256. */
  headers: Record<string, string>;
  payloadHash: string;
  accessKey: string;
  secretKey: string;
  region: string;
  /** yyyymmddThhmmssZ */
  amzDate: string;
  query?: string;
}

/** AWS SigV4 `Authorization` header value for an S3 request. */
export function signV4(i: SignInput): string {
  const names = Object.keys(i.headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(i.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = names.map((n) => `${n}:${String(lower[n]).trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    i.method,
    i.path,
    i.query ?? '',
    canonicalHeaders,
    signedHeaders,
    i.payloadHash,
  ].join('\n');
  const date = i.amzDate.slice(0, 8);
  const scope = `${date}/${i.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', i.amzDate, scope, sha256hex(canonicalRequest)].join(
    '\n',
  );
  const kDate = hmac(`AWS4${i.secretKey}`, date);
  const kRegion = hmac(kDate, i.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${i.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export const amzDateOf = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export class S3StorageService extends StorageService {
  readonly driver = 's3' as const;

  constructor(
    private readonly cfg: S3Config,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    super();
  }

  private url(key: string) {
    const endpoint = this.cfg.endpoint.replace(/\/+$/, '');
    const path = `/${encodeSegment(this.cfg.bucket)}/${key.split('/').map(encodeSegment).join('/')}`;
    return { href: `${endpoint}${path}`, host: new URL(endpoint).host, path };
  }

  private async send(method: string, key: string, body?: Buffer, contentType?: string) {
    assertValidKey(key);
    const { href, host, path } = this.url(key);
    const payloadHash = sha256hex(body ?? '');
    const amzDate = amzDateOf(new Date());
    const headers: Record<string, string> = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...(contentType ? { 'content-type': contentType } : {}),
    };
    const authorization = signV4({
      method,
      path,
      headers,
      payloadHash,
      accessKey: this.cfg.accessKey,
      secretKey: this.cfg.secretKey,
      region: this.cfg.region,
      amzDate,
    });
    const { host: _host, ...sendHeaders } = headers;
    return this.fetchFn(href, {
      method,
      headers: { ...sendHeaders, authorization },
      ...(body ? { body: new Uint8Array(body) } : {}),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.send('PUT', key, body, contentType);
    if (!res.ok) throw new Error(`S3 PUT ${key} failed: ${res.status} ${await res.text()}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.send('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 GET ${key} failed: ${res.status}`);
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    const res = await this.send('DELETE', key);
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE ${key} failed: ${res.status}`);
  }

  publicUrl(key: string): string {
    const base =
      this.cfg.publicUrl?.replace(/\/+$/, '') ??
      `${this.cfg.endpoint.replace(/\/+$/, '')}/${this.cfg.bucket}`;
    return `${base}/${key}`;
  }
}
