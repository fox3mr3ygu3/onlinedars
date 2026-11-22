import { Injectable } from '@nestjs/common';
import {
  type AdminFaq,
  type AdminListQuery,
  type FaqInput,
  type FaqUpdateInput,
  type Paginated,
  type PublicFaq,
  type PublicListQuery,
} from '@onlinedars/shared';
import type { Faq, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { paged, withContentErrors } from '../courses/content.utils';

export function toPublicFaq(f: Faq): PublicFaq {
  return { id: f.id, question: f.question, answer: f.answer, position: f.position };
}

export function toAdminFaq(f: Faq): AdminFaq {
  return {
    ...toPublicFaq(f),
    isActive: f.isActive,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

const order = [
  { position: 'asc' },
  { createdAt: 'asc' },
] satisfies Prisma.FaqOrderByWithRelationInput[];

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic({ page, pageSize }: PublicListQuery): Promise<Paginated<PublicFaq>> {
    const where = { isActive: true } satisfies Prisma.FaqWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.faq.findMany({
        where,
        orderBy: order,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.faq.count({ where }),
    ]);
    return paged(rows.map(toPublicFaq), total, page, pageSize);
  }

  async listAdmin({ page, pageSize, search }: AdminListQuery): Promise<Paginated<AdminFaq>> {
    const where: Prisma.FaqWhereInput = search
      ? {
          OR: [
            { question: { contains: search, mode: 'insensitive' } },
            { answer: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.faq.findMany({
        where,
        orderBy: order,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.faq.count({ where }),
    ]);
    return paged(rows.map(toAdminFaq), total, page, pageSize);
  }

  async get(id: string): Promise<AdminFaq> {
    const row = await this.prisma.faq.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return toAdminFaq(row);
  }

  create(input: FaqInput): Promise<AdminFaq> {
    return withContentErrors(async () => toAdminFaq(await this.prisma.faq.create({ data: input })));
  }

  update(id: string, input: FaqUpdateInput): Promise<AdminFaq> {
    return withContentErrors(async () =>
      toAdminFaq(await this.prisma.faq.update({ where: { id }, data: input })),
    );
  }

  async remove(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.faq.delete({ where: { id } }));
  }
}
