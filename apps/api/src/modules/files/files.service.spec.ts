import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorCode, MB } from '@onlinedars/shared';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorOf } from '../courses/testing/prisma-mock';
import { chooseDriver } from './files.module';
import { cleanFileName, contentMatchesMime, FilesService, newStorageKey } from './files.service';
import { LocalDiskStorageService } from './storage/local-disk-storage.service';
import { MemoryStorageService } from './storage/memory-storage.service';
import { S3StorageService, signV4 } from './storage/s3-storage.service';
import { STORAGE_KEY_RE } from './storage/storage.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n...');
const file = (buffer: Buffer, mimetype: string, originalname = 'f') => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname,
});

describe('FilesService.upload', () => {
  let storage: MemoryStorageService;
  let service: FilesService;

  beforeEach(() => {
    storage = new MemoryStorageService('http://api/files');
    service = new FilesService(storage);
  });

  it('stores a valid image and returns {id, url}', async () => {
    const res = await service.upload(file(PNG, 'image/png', 'rasm.png'), 'IMAGE');
    expect(res.id).toBe(res.key);
    expect(res.key).toMatch(STORAGE_KEY_RE);
    expect(res.key.endsWith('.png')).toBe(true);
    expect(res.url).toBe(`http://api/files/${res.key.replace('uploads/', '')}`);
    expect(storage.objects.get(res.key)?.contentType).toBe('image/png');
    expect(res).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: PNG.length,
      originalName: 'rasm.png',
    });
  });

  it('FILE_REQUIRED without a file', async () => {
    expect((await errorOf(() => service.upload(undefined, 'FILE'))).code).toBe(
      ErrorCode.FILE_REQUIRED,
    );
  });

  it('rejects a PDF as IMAGE and a disguised file (bytes do not match the MIME)', async () => {
    expect((await errorOf(() => service.upload(file(PDF, 'application/pdf'), 'IMAGE'))).code).toBe(
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
    );
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect((await errorOf(() => service.upload(file(html, 'image/png'), 'IMAGE'))).code).toBe(
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
    );
    expect((await errorOf(() => service.upload(file(html, 'text/html'), 'FILE'))).code).toBe(
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
    );
    expect(storage.objects.size).toBe(0);
  });

  it('enforces the size limit per purpose (images ≤ 5 MB)', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * MB)]);
    const e = await errorOf(() => service.upload(file(big, 'image/png'), 'IMAGE'));
    expect(e.code).toBe(ErrorCode.FILE_TOO_LARGE);
    expect(e.getStatus?.()).toBe(413);
  });

  it('accepts a PDF lesson file', async () => {
    const res = await service.upload(file(PDF, 'application/pdf', 'konspekt.pdf'), 'FILE');
    expect(res.key.endsWith('.pdf')).toBe(true);
  });
});

describe('file helpers', () => {
  it('contentMatchesMime checks magic bytes', () => {
    expect(contentMatchesMime(PNG, 'image/png')).toBe(true);
    expect(contentMatchesMime(PNG, 'image/jpeg')).toBe(false);
    expect(contentMatchesMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(contentMatchesMime(Buffer.from('PK\u0003\u0004rest'), 'application/zip')).toBe(true);
    expect(contentMatchesMime(Buffer.from('a,b\n1,2'), 'text/csv')).toBe(true);
    expect(contentMatchesMime(Buffer.from([0x61, 0x00, 0x62]), 'text/plain')).toBe(false);
    expect(contentMatchesMime(Buffer.from('x'), 'image/svg+xml')).toBe(false);
  });

  it('cleanFileName recovers UTF-8 and strips paths', () => {
    expect(cleanFileName(Buffer.from("o'quv.pdf", 'utf8').toString('latin1'))).toBe("o'quv.pdf");
    expect(cleanFileName('..\\..\\evil<>.pdf')).toBe('evil.pdf');
  });

  it('newStorageKey has the validated shape', () => {
    expect(newStorageKey('pdf', new Date('2026-03-05T00:00:00Z'))).toMatch(
      /^uploads\/2026\/03\/[a-f0-9]{32}\.pdf$/,
    );
  });

  it('chooseDriver: explicit, test → memory, S3_ENDPOINT → s3, else local disk', () => {
    expect(chooseDriver({ STORAGE_DRIVER: 'local', S3_ENDPOINT: 'http://minio' })).toBe('local');
    expect(chooseDriver({ NODE_ENV: 'test', S3_ENDPOINT: 'http://minio' })).toBe('memory');
    expect(chooseDriver({ NODE_ENV: 'development', S3_ENDPOINT: 'http://minio:9000' })).toBe('s3');
    expect(chooseDriver({ NODE_ENV: 'development', S3_ENDPOINT: ' ' })).toBe('local');
    expect(chooseDriver({ NODE_ENV: 'production' })).toBe('local');
  });
});

describe('LocalDiskStorageService', () => {
  let dir: string;
  afterAll(async () => dir && rm(dir, { recursive: true, force: true }));

  it('round-trips an object and refuses keys outside the uploads/ pattern', async () => {
    dir = await mkdtemp(join(tmpdir(), 'od-storage-'));
    const s = new LocalDiskStorageService(dir, 'http://api/files');
    const key = newStorageKey('png');
    await s.put(key, PNG, 'image/png');
    expect(await s.get(key)).toEqual({ body: PNG, contentType: 'image/png' });
    await s.delete(key);
    expect(await s.get(key)).toBeNull();
    await expect(s.put('uploads/../../etc/passwd', PNG, 'x')).rejects.toThrow();
    await expect(s.get('../secret')).rejects.toThrow();
  });
});

describe('S3 SigV4', () => {
  // AWS documentation example "GET Object" (examplebucket, 20130524).
  it('matches the AWS reference signature', () => {
    const auth = signV4({
      method: 'GET',
      path: '/test.txt',
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        range: 'bytes=0-9',
        'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'x-amz-date': '20130524T000000Z',
      },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      amzDate: '20130524T000000Z',
    });
    expect(auth).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('PUTs path-style to the bucket with a signed request; public URL uses S3_PUBLIC_URL', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    const s3 = new S3StorageService(
      {
        endpoint: 'http://localhost:9000/',
        region: 'us-east-1',
        bucket: 'onlinedars',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        publicUrl: 'https://files.onlinedars.uz/onlinedars/',
      },
      fetchFn as unknown as typeof fetch,
    );
    const key = newStorageKey('png');
    await s3.put(key, PNG, 'image/png');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://localhost:9000/onlinedars/${key}`);
    expect(init.method).toBe('PUT');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=minioadmin\//);
    expect(headers['content-type']).toBe('image/png');
    expect(s3.publicUrl(key)).toBe(`https://files.onlinedars.uz/onlinedars/${key}`);
  });

  it('throws when S3 answers with an error', async () => {
    const fetchFn = vi.fn(async () => new Response('denied', { status: 403 }));
    const s3 = new S3StorageService(
      {
        endpoint: 'http://m:9000',
        region: 'us-east-1',
        bucket: 'b',
        accessKey: 'a',
        secretKey: 's',
      },
      fetchFn as unknown as typeof fetch,
    );
    await expect(s3.put(newStorageKey('png'), PNG, 'image/png')).rejects.toThrow(/403/);
  });
});
