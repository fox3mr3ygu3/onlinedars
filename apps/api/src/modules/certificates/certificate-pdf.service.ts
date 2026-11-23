import { Injectable, Logger } from '@nestjs/common';
import { certificateVerifyPath } from '@onlinedars/shared';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { BUILTIN_CERTIFICATE_HTML } from '../../templates/certificate/default-template';
import { PdfRenderer } from './pdf/pdf-renderer';
import { CertificateStorage, certificatePdfKey } from './storage/certificate-storage';
import { formatIssueDate, renderCertificateHtml } from './template-render';

/** Public verify URL printed on the PDF: `${WEB_URL}/verify/{publicId}`. */
export function verifyUrlFor(webUrl: string, publicId: string): string {
  return `${webUrl.replace(/\/+$/, '')}${certificateVerifyPath(publicId)}`;
}

/**
 * Renders a certificate to PDF and stores it. Runs in the worker (BullMQ `certificate-pdf`)
 * or inline when there is no Redis. Idempotent: an existing PDF is kept unless `force`.
 */
@Injectable()
export class CertificatePdfService {
  private readonly logger = new Logger(CertificatePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PdfRenderer,
    private readonly storage: CertificateStorage,
    private readonly config: AppConfig,
  ) {}

  /** Template priority: the certificate's own → course's → platform default → built-in. */
  async resolveTemplate(
    templateId: string | null,
    courseId: string,
  ): Promise<{ html: string; backgroundImageUrl: string | null }> {
    const select = { html: true, backgroundImageUrl: true } as const;
    if (templateId) {
      const t = await this.prisma.certificateTemplate.findUnique({
        where: { id: templateId },
        select,
      });
      if (t) return t;
    }
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { certificateTemplate: { select } },
    });
    if (course?.certificateTemplate) return course.certificateTemplate;
    const def = await this.prisma.certificateTemplate.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
      select,
    });
    return def ?? { html: BUILTIN_CERTIFICATE_HTML, backgroundImageUrl: null };
  }

  async buildHtml(certificateId: string): Promise<string> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      select: {
        publicId: true,
        fullName: true,
        courseTitle: true,
        issuedAt: true,
        templateId: true,
        courseId: true,
      },
    });
    if (!cert) throw new Error(`Certificate ${certificateId} not found`);
    const template = await this.resolveTemplate(cert.templateId, cert.courseId);
    return renderCertificateHtml(template.html, {
      fullName: cert.fullName,
      courseTitle: cert.courseTitle,
      issuedAt: formatIssueDate(cert.issuedAt),
      certificateId: cert.publicId,
      verifyUrl: verifyUrlFor(this.config.env.WEB_URL, cert.publicId),
      backgroundImageUrl: template.backgroundImageUrl ?? '',
    });
  }

  /** Renders + uploads; returns the storage key. */
  async generate(certificateId: string, force = false): Promise<string> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      select: { id: true, publicId: true, pdfKey: true },
    });
    if (!cert) throw new Error(`Certificate ${certificateId} not found`);
    if (cert.pdfKey && !force) return cert.pdfKey;

    const html = await this.buildHtml(certificateId);
    const pdf = await this.renderer.render(html);
    const key = certificatePdfKey(cert.publicId);
    await this.storage.put(key, pdf, 'application/pdf');
    await this.prisma.certificate.update({
      where: { id: cert.id },
      data: { pdfKey: key, pdfGeneratedAt: new Date() },
    });
    this.logger.log(`Certificate PDF generated: ${cert.publicId}`);
    return key;
  }
}
