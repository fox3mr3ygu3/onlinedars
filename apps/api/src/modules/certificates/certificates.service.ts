import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type CertificateVerify,
  ErrorCode,
  NotificationType,
  type Paginated,
  type PaginationQuery,
  type StudentCertificateItem,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { CertificatePdfQueue } from '../../jobs/certificate-pdf.queue';
import { PrismaService } from '../../prisma/prisma.service';
import { generateCertificatePublicId, normalizeCertificatePublicId } from './certificate-id';
import { verifyUrlFor } from './certificate-pdf.service';
import { CertificateStorage } from './storage/certificate-storage';

export interface IssueInput {
  userId: string;
  courseId: string;
  examAttemptId: string | null;
}

export interface IssuedCertificate {
  id: string;
  publicId: string;
  /** False when the user already had a certificate for this course. */
  created: boolean;
}

const MAX_ID_RETRIES = 5;

function uniqueTarget(err: unknown): string | null {
  if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'P2002') {
    const target = (err as { meta?: { target?: unknown } }).meta?.target;
    return Array.isArray(target) ? target.join(',') : String(target ?? '');
  }
  return null;
}

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: CertificatePdfQueue,
    private readonly storage: CertificateStorage,
    private readonly config: AppConfig,
  ) {}

  /**
   * Issues the course certificate after a passed exam — at most once per (user, course)
   * (CLAUDE.md rule 6). Safe under concurrency: the DB unique (userId, courseId) decides,
   * a losing racer gets the existing certificate back.
   */
  async issueForPass(input: IssueInput): Promise<IssuedCertificate> {
    const { userId, courseId } = input;
    const existing = await this.findExisting(userId, courseId);
    if (existing) return { ...existing, created: false };

    const [user, course] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, certificateTemplateId: true },
      }),
    ]);
    if (!user || !course) throw AppException.notFound();
    const templateId =
      course.certificateTemplateId ??
      (
        await this.prisma.certificateTemplate.findFirst({
          where: { isDefault: true },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      )?.id ??
      null;

    for (let i = 0; i < MAX_ID_RETRIES; i++) {
      try {
        const cert = await this.prisma.certificate.create({
          data: {
            publicId: generateCertificatePublicId(),
            userId,
            courseId,
            examAttemptId: input.examAttemptId,
            templateId,
            fullName: user.fullName,
            courseTitle: course.title,
          },
          select: { id: true, publicId: true },
        });
        await this.afterIssue(userId, courseId, cert);
        return { ...cert, created: true };
      } catch (err) {
        const target = uniqueTarget(err);
        if (target === null) throw err;
        if (target.includes('publicId')) continue; // ID collision — draw another
        const raced = await this.findExisting(userId, courseId);
        if (raced) return { ...raced, created: false };
        throw err;
      }
    }
    throw new Error('Could not generate a unique certificate ID');
  }

  private findExisting(userId: string, courseId: string) {
    return this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, publicId: true },
    });
  }

  private async afterIssue(
    userId: string,
    courseId: string,
    cert: { id: string; publicId: string },
  ): Promise<void> {
    await this.prisma.enrollment.updateMany({
      where: { userId, courseId, completedAt: null },
      data: { completedAt: new Date() },
    });
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: NotificationType.CERTIFICATE_ISSUED,
          title: 'certificateIssued',
          body: cert.publicId,
          data: { certificateId: cert.id, publicId: cert.publicId, courseId },
        },
      });
    } catch (err) {
      this.logger.warn(`Notification for certificate ${cert.publicId} failed: ${String(err)}`);
    }
    await this.queue.enqueue(cert.id);
  }

  toItem(c: {
    id: string;
    publicId: string;
    courseId: string;
    courseTitle: string;
    fullName: string;
    issuedAt: Date;
    pdfKey: string | null;
  }): StudentCertificateItem {
    return {
      id: c.id,
      publicId: c.publicId,
      courseId: c.courseId,
      courseTitle: c.courseTitle,
      fullName: c.fullName,
      issuedAt: c.issuedAt.toISOString(),
      verifyUrl: verifyUrlFor(this.config.env.WEB_URL, c.publicId),
      pdfReady: Boolean(c.pdfKey),
    };
  }

  async listForUser(
    userId: string,
    q: PaginationQuery,
  ): Promise<Paginated<StudentCertificateItem>> {
    const where = { userId, revokedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: itemSelect,
      }),
      this.prisma.certificate.count({ where }),
    ]);
    return { items: rows.map((r) => this.toItem(r)), total, page: q.page, pageSize: q.pageSize };
  }

  /**
   * The PDF of the caller's own certificate. Another user's certificate answers 404 (no
   * existence leak). If the PDF isn't rendered yet the job is (re-)enqueued: inline mode
   * renders right away, otherwise 409 CERTIFICATE_PDF_PENDING tells the client to retry.
   */
  async getOwnPdf(
    userId: string,
    certificateId: string,
  ): Promise<{ body: Buffer; filename: string }> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      select: { id: true, userId: true, publicId: true, pdfKey: true, revokedAt: true },
    });
    if (!cert || cert.userId !== userId || cert.revokedAt) {
      throw AppException.notFound(ErrorCode.CERTIFICATE_NOT_FOUND);
    }
    let key = cert.pdfKey;
    if (!key) {
      await this.queue.enqueue(cert.id);
      key =
        (
          await this.prisma.certificate.findUnique({
            where: { id: cert.id },
            select: { pdfKey: true },
          })
        )?.pdfKey ?? null;
    }
    if (!key) {
      throw new AppException(ErrorCode.CERTIFICATE_PDF_PENDING, HttpStatus.CONFLICT);
    }
    return { body: await this.storage.get(key), filename: `${cert.publicId}.pdf` };
  }

  /** Public verification by printed ID. Revoked certificates are returned with isValid=false. */
  async verify(code: string): Promise<CertificateVerify> {
    const publicId = normalizeCertificatePublicId(code);
    if (!publicId) throw AppException.notFound(ErrorCode.CERTIFICATE_NOT_FOUND);
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        fullName: true,
        courseTitle: true,
        issuedAt: true,
        revokedAt: true,
      },
    });
    if (!cert) throw AppException.notFound(ErrorCode.CERTIFICATE_NOT_FOUND);
    return {
      certificateId: cert.publicId,
      fullName: cert.fullName,
      courseTitle: cert.courseTitle,
      issuedAt: cert.issuedAt.toISOString(),
      isValid: !cert.revokedAt,
    };
  }
}

export const itemSelect = {
  id: true,
  publicId: true,
  courseId: true,
  courseTitle: true,
  fullName: true,
  issuedAt: true,
  pdfKey: true,
} as const;
