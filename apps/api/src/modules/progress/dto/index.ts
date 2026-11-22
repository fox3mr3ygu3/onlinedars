import { paginationQuerySchema, practiceSubmitSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class PracticeSubmitDto extends createZodDto(practiceSubmitSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
