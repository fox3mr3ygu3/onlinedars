import { questionInputSchema, questionUpdateSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { ReorderDto } from '../../courses/dto/common';

export class QuestionInputDto extends createZodDto(questionInputSchema) {}
export class QuestionUpdateDto extends createZodDto(questionUpdateSchema) {}
