import {
  certificateTemplateInputSchema,
  certificateTemplatePreviewSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class CertificateTemplateDto extends createZodDto(certificateTemplateInputSchema) {}
export class CertificateTemplatePreviewDto extends createZodDto(certificateTemplatePreviewSchema) {}
