/** DTOs reused by several content controllers (one class per schema keeps Swagger names unique). */
import { adminListQuerySchema, publicListQuerySchema, reorderSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class PublicListQueryDto extends createZodDto(publicListQuerySchema) {}
export class AdminListQueryDto extends createZodDto(adminListQuerySchema) {}
export class ReorderDto extends createZodDto(reorderSchema) {}
