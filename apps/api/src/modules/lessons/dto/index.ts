import {
  lessonCompletenessResponseSchema,
  lessonInputSchema,
  lessonMaterialInputSchema,
  lessonMaterialUpdateSchema,
  lessonUpdateSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { ReorderDto } from '../../courses/dto/common';

export class LessonInputDto extends createZodDto(lessonInputSchema) {}
export class LessonUpdateDto extends createZodDto(lessonUpdateSchema) {}
export class LessonMaterialInputDto extends createZodDto(lessonMaterialInputSchema) {}
export class LessonMaterialUpdateDto extends createZodDto(lessonMaterialUpdateSchema) {}
export class LessonCompletenessDto extends createZodDto(lessonCompletenessResponseSchema) {}
