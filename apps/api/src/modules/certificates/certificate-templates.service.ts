import { Injectable } from '@nestjs/common';
import type {
  CertificateTemplateInput,
  CertificateTemplateItem,
  CertificateTemplatePreviewInput,
  Paginated,
  PaginationQuery,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyUrlFor } from './certificate-pdf.service';
import { renderCertificateHtml, SAMPLE_TEMPLATE_DATA } from './template-render';

const select = {
  id: true,
  name: true,
  html: true,
  backgroundImageUrl: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { courses: true } },
} as const;

type Row = {
  id: string;
  name: string;
  html: string;
  backgroundImageUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { courses: number };
};

const toItem = (r: Row): CertificateTemplateItem => ({
  id: r.id,
  name: r.name,
  html: r.html,
  backgroundImageUrl: r.backgroundImageUrl,
  isDefault: r.isDefault,
  courseCount: r._count.courses,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Admin CRUD for certificate templates. At most one template is the default. */
@Injectable()
export class CertificateTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async list(q: PaginationQuery): Promise<Paginated<CertificateTemplateItem>> {
    const [rows, total] = await Promise.all([
      this.prisma.certificateTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select,
      }),
      this.prisma.certificateTemplate.count(),
    ]);
    return { items: rows.map(toItem), total, page: q.page, pageSize: q.pageSize };
  }

  async get(id: string): Promise<CertificateTemplateItem> {
    const row = await this.prisma.certificateTemplate.findUnique({ where: { id }, select });
    if (!row) throw AppException.notFound();
    return toItem(row);
  }

  async create(input: CertificateTemplateInput): Promise<CertificateTemplateItem> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.certificateTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.certificateTemplate.create({
        data: {
          name: input.name,
          html: input.html,
          backgroundImageUrl: input.backgroundImageUrl ?? null,
          isDefault: input.isDefault,
        },
        select,
      });
    });
    return toItem(row);
  }

  async update(id: string, input: CertificateTemplateInput): Promise<CertificateTemplateItem> {
    await this.get(id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.certificateTemplate.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.certificateTemplate.update({
        where: { id },
        data: {
          name: input.name,
          html: input.html,
          backgroundImageUrl: input.backgroundImageUrl ?? null,
          isDefault: input.isDefault,
        },
        select,
      });
    });
    return toItem(row);
  }

  /**
   * Deleting is safe for issued certificates: they keep their snapshot and fall back to the
   * course/default/built-in template if the PDF is ever re-rendered (FK is SET NULL).
   */
  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.certificateTemplate.delete({ where: { id } });
  }

  /** Renders template HTML with sample data, for the admin preview (no PDF). */
  preview(input: CertificateTemplatePreviewInput): { html: string } {
    return {
      html: renderCertificateHtml(input.html, {
        ...SAMPLE_TEMPLATE_DATA,
        verifyUrl: verifyUrlFor(this.config.env.WEB_URL, SAMPLE_TEMPLATE_DATA.certificateId),
        backgroundImageUrl: input.backgroundImageUrl ?? '',
      }),
    };
  }
}
