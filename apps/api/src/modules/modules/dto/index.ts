import { moduleInputSchema, moduleUpdateSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { ReorderDto } from '../../courses/dto/common';

export class ModuleInputDto extends createZodDto(moduleInputSchema) {}
export class ModuleUpdateDto extends createZodDto(moduleUpdateSchema) {}
