import { ErrorCode } from '@onlinedars/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { parseEnv } from '../../config/env';
import { processCertificatePdfJob } from '../../jobs/certificate-pdf.processor';
import {
  type CertificatePdfQueue,
  InlineCertificatePdfQueue,
  redisConnectionFromUrl,
  redisUrlFromEnv,
} from '../../jobs/certificate-pdf.queue';
import { BUILTIN_CERTIFICATE_HTML } from '../../templates/certificate/default-template';
import { createMockPrisma, type MockPrisma } from '../progress/testing/mock-prisma';
import { generateCertificatePublicId, normalizeCertificatePublicId } from './certificate-id';
import { CertificatePdfService, verifyUrlFor } from './certificate-pdf.service';
import { CertificateTemplatesService } from './certificate-templates.service';
import { CertificatesService } from './certificates.service';
import { PdfRenderer, PuppeteerPdfRenderer, puppeteerLaunchOptions } from './pdf/pdf-renderer';
import { MemoryCertificateStorage } from './storage/certificate-storage';
import { escapeHtml, formatIssueDate, renderCertificateHtml } from './template-render';

const config = new AppConfig(
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    WEB_URL: 'https://onlinedars.uz/',
  }),
);

async function expectCode(p: Promise<unknown>, code: string, status?: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  if (status) expect((err as AppException).getStatus()).toBe(status);
}

class FakeRenderer extends PdfRenderer {
  readonly htmls: string[] = [];
  async render(html: string): Promise<Buffer> {
    this.htmls.push(html);
    return Buffer.from('%PDF-fake');
  }
}

describe('certificate ID', () => {
  it('has the OD-XXXX-XXXX-XXXX shape with Crockford characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCertificatePublicId()).toMatch(
        /^OD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
      );
    }
  });
  it('is random (no duplicates in 1000 draws)', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateCertificatePublicId()));
    expect(ids.size).toBe(1000);
  });
  it('normalises user input (case, spaces, missing dashes, O/I/L look-alikes)', () => {
    expect(normalizeCertificatePublicId(' od-7k2m-q9xd-4hpt ')).toBe('OD-7K2M-Q9XD-4HPT');
    expect(normalizeCertificatePublicId('7K2MQ9XD4HPT')).toBe('OD-7K2M-Q9XD-4HPT');
    expect(normalizeCertificatePublicId('OD-OOOO-IIII-LLLL')).toBe('OD-0000-1111-1111');
  });
  it('rejects garbage without touching the DB', () => {
    expect(normalizeCertificatePublicId('hello')).toBeNull();
    expect(normalizeCertificatePublicId("OD-1234-5678-9AB'")).toBeNull();
    expect(normalizeCertificatePublicId('OD-1234-5678-9ABU')).toBeNull();
  });
});

describe('template rendering', () => {
  it('fills placeholders and escapes HTML in user-provided values', () => {
    const html = renderCertificateHtml('<p>{{fullName}}</p><p>{{ courseTitle }}</p>{{unknown}}', {
      fullName: '<script>alert(1)</script>',
      courseTitle: 'A & B',
      issuedAt: '',
      certificateId: '',
      verifyUrl: '',
      backgroundImageUrl: '',
    });
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><p>A &amp; B</p>{{unknown}}');
  });
  it('escapeHtml escapes quotes', () => {
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });
  it('formats dates in Tashkent time', () => {
    expect(formatIssueDate(new Date('2026-11-22T20:30:00Z'))).toBe('23.11.2026');
  });
  it('verify URL uses WEB_URL without double slashes', () => {
    expect(verifyUrlFor('https://onlinedars.uz/', 'OD-1')).toBe(
      'https://onlinedars.uz/verify/OD-1',
    );
  });
});

describe('CertificatesService', () => {
  let mock: MockPrisma;
  let service: CertificatesService;
  let queue: { enqueue: ReturnType<typeof vi.fn> };
  let storage: MemoryCertificateStorage;

  beforeEach(() => {
    const m = createMockPrisma();
    mock = m.mock;
    queue = { enqueue: vi.fn(async () => undefined) };
    storage = new MemoryCertificateStorage();
    service = new CertificatesService(
      m.prisma,
      queue as unknown as CertificatePdfQueue,
      storage,
      config,
    );
    mock.user.findUnique.mockResolvedValue({ fullName: 'Ali Valiyev' });
    mock.course.findUnique.mockResolvedValue({ title: 'Kurs', certificateTemplateId: 't1' });
    mock.certificate.create.mockImplementation(async (args: { data: { publicId: string } }) => ({
      id: 'cert1',
      publicId: args.data.publicId,
    }));
  });

  const input = { userId: 'u1', courseId: 'c1', examAttemptId: 'a1' };

  it('issues a certificate with snapshot data, marks course complete, enqueues the PDF', async () => {
    const res = await service.issueForPass(input);
    expect(res.created).toBe(true);
    expect(mock.certificate.create.mock.calls[0]![0].data).toMatchObject({
      userId: 'u1',
      courseId: 'c1',
      examAttemptId: 'a1',
      templateId: 't1',
      fullName: 'Ali Valiyev',
      courseTitle: 'Kurs',
    });
    expect(mock.enrollment.updateMany).toHaveBeenCalled();
    expect(mock.notification.create).toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith('cert1');
  });

  it('issues only once per (user, course): an existing certificate is returned', async () => {
    mock.certificate.findUnique.mockResolvedValue({ id: 'old', publicId: 'OD-OLD' });
    const res = await service.issueForPass(input);
    expect(res).toEqual({ id: 'old', publicId: 'OD-OLD', created: false });
    expect(mock.certificate.create).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('a concurrent issue that loses the unique (userId, courseId) race returns the winner', async () => {
    mock.certificate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner', publicId: 'OD-WIN' });
    mock.certificate.create.mockRejectedValue(
      Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['userId', 'courseId'] },
      }),
    );
    const res = await service.issueForPass(input);
    expect(res).toEqual({ id: 'winner', publicId: 'OD-WIN', created: false });
  });

  it('retries with a new ID on a publicId collision', async () => {
    mock.certificate.create
      .mockRejectedValueOnce(
        Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['publicId'] } }),
      )
      .mockImplementationOnce(async (args: { data: { publicId: string } }) => ({
        id: 'cert2',
        publicId: args.data.publicId,
      }));
    const res = await service.issueForPass(input);
    expect(res.id).toBe('cert2');
    expect(mock.certificate.create).toHaveBeenCalledTimes(2);
  });

  it('verify returns public data only', async () => {
    mock.certificate.findUnique.mockResolvedValue({
      publicId: 'OD-7K2M-Q9XD-4HPT',
      fullName: 'Ali',
      courseTitle: 'Kurs',
      issuedAt: new Date('2026-11-23T00:00:00Z'),
      revokedAt: null,
    });
    const v = await service.verify('od-7k2m-q9xd-4hpt');
    expect(v).toEqual({
      certificateId: 'OD-7K2M-Q9XD-4HPT',
      fullName: 'Ali',
      courseTitle: 'Kurs',
      issuedAt: '2026-11-23T00:00:00.000Z',
      isValid: true,
    });
    expect(mock.certificate.findUnique.mock.calls[0]![0].where).toEqual({
      publicId: 'OD-7K2M-Q9XD-4HPT',
    });
  });

  it('verify: revoked → isValid=false; unknown → 404', async () => {
    mock.certificate.findUnique.mockResolvedValueOnce({
      publicId: 'OD-7K2M-Q9XD-4HPT',
      fullName: 'Ali',
      courseTitle: 'Kurs',
      issuedAt: new Date(),
      revokedAt: new Date(),
    });
    expect((await service.verify('OD-7K2M-Q9XD-4HPT')).isValid).toBe(false);
    await expectCode(service.verify('OD-7K2M-Q9XD-4HPZ'), ErrorCode.CERTIFICATE_NOT_FOUND, 404);
    await expectCode(service.verify('garbage'), ErrorCode.CERTIFICATE_NOT_FOUND, 404);
  });

  it('PDF download: owner gets the file', async () => {
    await storage.put('certificates/OD-1.pdf', Buffer.from('%PDF'), 'application/pdf');
    mock.certificate.findUnique.mockResolvedValue({
      id: 'cert1',
      userId: 'u1',
      publicId: 'OD-1',
      pdfKey: 'certificates/OD-1.pdf',
      revokedAt: null,
    });
    const file = await service.getOwnPdf('u1', 'cert1');
    expect(file.filename).toBe('OD-1.pdf');
    expect(file.body.toString()).toBe('%PDF');
  });

  it("PDF download: another student's certificate is 404 (ownership)", async () => {
    mock.certificate.findUnique.mockResolvedValue({
      id: 'cert1',
      userId: 'owner',
      publicId: 'OD-1',
      pdfKey: 'k',
      revokedAt: null,
    });
    await expectCode(service.getOwnPdf('intruder', 'cert1'), ErrorCode.CERTIFICATE_NOT_FOUND, 404);
  });

  it('PDF download: not rendered yet → re-enqueue + 409 CERTIFICATE_PDF_PENDING', async () => {
    mock.certificate.findUnique.mockResolvedValue({
      id: 'cert1',
      userId: 'u1',
      publicId: 'OD-1',
      pdfKey: null,
      revokedAt: null,
    });
    await expectCode(service.getOwnPdf('u1', 'cert1'), ErrorCode.CERTIFICATE_PDF_PENDING, 409);
    expect(queue.enqueue).toHaveBeenCalledWith('cert1');
  });

  it('lists only the caller’s certificates', async () => {
    await service.listForUser('u1', { page: 1, pageSize: 20 });
    expect(mock.certificate.findMany.mock.calls[0]![0].where).toEqual({
      userId: 'u1',
      revokedAt: null,
    });
  });
});

describe('CertificatePdfService', () => {
  let mock: MockPrisma;
  let renderer: FakeRenderer;
  let storage: MemoryCertificateStorage;
  let pdf: CertificatePdfService;

  const cert = {
    id: 'cert1',
    publicId: 'OD-7K2M-Q9XD-4HPT',
    fullName: 'Ali <Valiyev>',
    courseTitle: 'Kurs',
    issuedAt: new Date('2026-11-23T05:00:00Z'),
    templateId: null,
    courseId: 'c1',
    pdfKey: null,
  };

  beforeEach(() => {
    const m = createMockPrisma();
    mock = m.mock;
    renderer = new FakeRenderer();
    storage = new MemoryCertificateStorage();
    pdf = new CertificatePdfService(m.prisma, renderer, storage, config);
    mock.certificate.findUnique.mockResolvedValue(cert);
  });

  it('renders the template, stores the PDF and saves the key', async () => {
    mock.course.findUnique.mockResolvedValue({
      certificateTemplate: {
        html: '<b>{{fullName}}</b> {{verifyUrl}} {{issuedAt}}',
        backgroundImageUrl: null,
      },
    });
    const key = await pdf.generate('cert1');
    expect(key).toBe('certificates/OD-7K2M-Q9XD-4HPT.pdf');
    expect(renderer.htmls[0]).toBe(
      '<b>Ali &lt;Valiyev&gt;</b> https://onlinedars.uz/verify/OD-7K2M-Q9XD-4HPT 23.11.2026',
    );
    expect(storage.objects.get(key)?.contentType).toBe('application/pdf');
    expect(mock.certificate.update.mock.calls[0]![0].data).toMatchObject({ pdfKey: key });
  });

  it('falls back to the built-in template', async () => {
    await pdf.generate('cert1');
    expect(renderer.htmls[0]).toContain('SERTIFIKAT');
    expect(BUILTIN_CERTIFICATE_HTML).toContain('{{certificateId}}');
  });

  it('is idempotent: an existing PDF is not re-rendered', async () => {
    mock.certificate.findUnique.mockResolvedValue({ ...cert, pdfKey: 'certificates/x.pdf' });
    await expect(pdf.generate('cert1')).resolves.toBe('certificates/x.pdf');
    expect(renderer.htmls).toHaveLength(0);
  });
});

describe('certificate-pdf job', () => {
  it('processor calls generate with the job certificate id', async () => {
    const generate = vi.fn(async () => 'key');
    await expect(
      processCertificatePdfJob({ generate }, { data: { certificateId: 'c9' } }),
    ).resolves.toEqual({
      key: 'key',
    });
    expect(generate).toHaveBeenCalledWith('c9');
  });

  it('inline queue runs the job and never throws', async () => {
    const generate = vi.fn(async () => {
      throw new Error('chromium missing');
    });
    const q = new InlineCertificatePdfQueue({ generate } as unknown as CertificatePdfService);
    await expect(q.enqueue('c1')).resolves.toBeUndefined();
    expect(generate).toHaveBeenCalledWith('c1');
  });

  it('inline mode when REDIS_URL is missing', () => {
    expect(redisUrlFromEnv({})).toBeUndefined();
    expect(redisUrlFromEnv({ REDIS_URL: '  ' })).toBeUndefined();
    expect(redisUrlFromEnv({ REDIS_URL: 'redis://r:6379' })).toBe('redis://r:6379');
  });

  it('parses redis URLs for BullMQ', () => {
    expect(redisConnectionFromUrl('rediss://user:p%40ss@cache:6380/2')).toMatchObject({
      host: 'cache',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    });
    expect(redisConnectionFromUrl('redis://localhost')).toMatchObject({ port: 6379, db: 0 });
  });
});

describe('PuppeteerPdfRenderer (mocked browser)', () => {
  it('launch options follow devops: executablePath from env, no-sandbox, no /dev/shm', () => {
    const opts = puppeteerLaunchOptions({ PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium' });
    expect(opts.executablePath).toBe('/usr/bin/chromium');
    expect(opts.args).toEqual(expect.arrayContaining(['--no-sandbox', '--disable-dev-shm-usage']));
  });

  it('renders via one reused browser and closes pages', async () => {
    const page = {
      setContent: vi.fn(async () => undefined),
      pdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
      close: vi.fn(async () => undefined),
    };
    const browser = { newPage: vi.fn(async () => page), close: vi.fn(async () => undefined) };
    const launch = vi.fn(async () => browser);
    const r = new PuppeteerPdfRenderer(launch);
    const out = await r.render('<p>x</p>');
    await r.render('<p>y</p>');
    expect(out.toString()).toBe('%PDF');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(page.close).toHaveBeenCalledTimes(2);
    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'A4', landscape: true }),
    );
    await r.onModuleDestroy();
    expect(browser.close).toHaveBeenCalled();
  });
});

describe('CertificateTemplatesService', () => {
  it('creating a default template clears the previous default', async () => {
    const { mock, prisma } = createMockPrisma();
    const now = new Date();
    mock.certificateTemplate.create.mockResolvedValue({
      id: 't1',
      name: 'N',
      html: 'h',
      backgroundImageUrl: null,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      _count: { courses: 0 },
    });
    const svc = new CertificateTemplatesService(prisma, config);
    const t = await svc.create({ name: 'N', html: 'h', backgroundImageUrl: null, isDefault: true });
    expect(mock.certificateTemplate.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(t.isDefault).toBe(true);
  });

  it('preview renders sample data', () => {
    const { prisma } = createMockPrisma();
    const svc = new CertificateTemplatesService(prisma, config);
    expect(svc.preview({ html: '{{fullName}} {{certificateId}}' }).html).toBe(
      'Ali Valiyev OD-0000-0000-0000',
    );
  });

  it('404 when updating an unknown template', async () => {
    const { prisma } = createMockPrisma();
    const svc = new CertificateTemplatesService(prisma, config);
    await expectCode(
      svc.update('nope', { name: 'N', html: 'h', backgroundImageUrl: null, isDefault: false }),
      ErrorCode.NOT_FOUND,
      404,
    );
  });
});
