import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type AuthPrincipal,
  type CertificateTemplateItem,
  type CertificateVerify,
  type Paginated,
  Role,
  type StudentCertificateItem,
} from '@onlinedars/shared';
import type { Response } from 'express';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { PaginationQueryDto } from '../progress/dto';
import { CertificateTemplatesService } from './certificate-templates.service';
import { CertificatesService } from './certificates.service';
import { CertificateTemplateDto, CertificateTemplatePreviewDto } from './dto';

@ApiTags('certificates')
@Controller('certificates')
export class CertificatesPublicController {
  constructor(private readonly certificates: CertificatesService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('verify/:certificateCode')
  @ApiOperation({ summary: 'Public certificate check by printed ID (e.g. OD-7K2M-Q9XD-4HPT)' })
  @ApiOkResponse({ description: 'CertificateVerify; 404 CERTIFICATE_NOT_FOUND' })
  verify(@Param('certificateCode') code: string): Promise<CertificateVerify> {
    return this.certificates.verify(code);
  }
}

@ApiTags('me: certificates')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('me/certificates')
export class MeCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated<StudentCertificateItem>' })
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<StudentCertificateItem>> {
    return this.certificates.listForUser(user.id, query);
  }

  @Get(':id/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Download my certificate PDF (409 CERTIFICATE_PDF_PENDING if not ready)',
  })
  async pdf(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { body, filename } = await this.certificates.getOwnPdf(user.id, id);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(body, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: body.length,
    });
  }
}

@ApiTags('admin: certificate templates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/certificate-templates')
export class AdminCertificateTemplatesController {
  constructor(private readonly templates: CertificateTemplatesService) {}

  @Get()
  @ApiOkResponse({ description: 'Paginated<CertificateTemplateItem>' })
  list(@Query() query: PaginationQueryDto): Promise<Paginated<CertificateTemplateItem>> {
    return this.templates.list(query);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Render template HTML with sample data (render in a sandboxed iframe)' })
  preview(@Body() dto: CertificateTemplatePreviewDto): { html: string } {
    return this.templates.preview(dto);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CertificateTemplateItem> {
    return this.templates.get(id);
  }

  @Post()
  create(@Body() dto: CertificateTemplateDto): Promise<CertificateTemplateItem> {
    return this.templates.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CertificateTemplateDto,
  ): Promise<CertificateTemplateItem> {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id') id: string): Promise<void> {
    return this.templates.remove(id);
  }
}
