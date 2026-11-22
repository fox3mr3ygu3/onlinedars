import {
  type ArgumentsHost,
  Body,
  Catch,
  Controller,
  type ExceptionFilter,
  Get,
  Param,
  PayloadTooLargeException,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CONTENT_ROLES,
  ErrorCode,
  UPLOAD_MAX_BYTES,
  type UploadedFile as UploadedFileResult,
  uploadedFileSchema,
  uploadFieldsSchema,
} from '@onlinedars/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { Public, Roles } from '../../common/decorators';
import { AppException } from '../../common/errors/app.exception';
import { toErrorBody } from '../../common/filters/all-exceptions.filter';
import { FilesService, type IncomingFile } from './files.service';
import { STORAGE_KEY_RE } from './storage/storage.service';

class UploadFieldsDto extends createZodDto(uploadFieldsSchema) {}
class UploadedFileDto extends createZodDto(uploadedFileSchema) {}

const HARD_LIMIT = Math.max(...Object.values(UPLOAD_MAX_BYTES));

/** Multer's "file too large" → 413 FILE_TOO_LARGE with the stable error shape. */
@Catch(PayloadTooLargeException)
export class UploadTooLargeFilter implements ExceptionFilter {
  catch(_e: PayloadTooLargeException, host: ArgumentsHost): void {
    const body = toErrorBody(
      new AppException(ErrorCode.FILE_TOO_LARGE, 413, `Max ${HARD_LIMIT} bytes`, {
        maxBytes: HARD_LIMIT,
      }),
    );
    host.switchToHttp().getResponse<Response>().status(413).json(body);
  }
}

@ApiTags('admin: files')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HARD_LIMIT, files: 1 } }))
  @ApiOperation({
    summary: 'Upload an image (≤5 MB: jpeg/png/webp/gif) or file (≤50 MB: pdf/office/zip/txt/csv)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: ['IMAGE', 'FILE'], default: 'FILE' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadedFileDto })
  upload(
    @UploadedFile() file: IncomingFile | undefined,
    @Body() fields: UploadFieldsDto,
  ): Promise<UploadedFileResult> {
    return this.files.upload(file, fields.purpose);
  }
}

/** Serves uploads when the local-disk (dev) or memory (test) driver is active; S3 serves its own. */
@ApiTags('files')
@Controller('files')
export class PublicFilesController {
  constructor(private readonly files: FilesService) {}

  @Public()
  @Get(':year/:month/:name')
  @ApiOperation({ summary: 'Download an uploaded file (local storage driver only)' })
  async serve(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('name') name: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `uploads/${year}/${month}/${name}`;
    if (this.files.driver === 's3' || !STORAGE_KEY_RE.test(key)) throw AppException.notFound();
    const obj = await this.files.read(key);
    if (!obj) throw AppException.notFound();
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      obj.contentType.startsWith('image/') ? 'inline' : `attachment; filename="${name}"`,
    );
    res.send(obj.body);
  }
}
