import { practiceInputSchema, practiceUpdateSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { ReorderDto } from '../../courses/dto/common';

export class PracticeInputDto extends createZodDto(practiceInputSchema) {}
export class PracticeUpdateDto extends createZodDto(practiceUpdateSchema) {}
