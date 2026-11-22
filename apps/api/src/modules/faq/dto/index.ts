import { faqInputSchema, faqUpdateSchema, publicFaqListSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { AdminListQueryDto, PublicListQueryDto } from '../../courses/dto/common';

export class FaqInputDto extends createZodDto(faqInputSchema) {}
export class FaqUpdateDto extends createZodDto(faqUpdateSchema) {}
export class PublicFaqListDto extends createZodDto(publicFaqListSchema) {}
