import { publicTeacherListSchema, teacherInputSchema, teacherUpdateSchema } from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { AdminListQueryDto, PublicListQueryDto } from '../../courses/dto/common';

export class TeacherInputDto extends createZodDto(teacherInputSchema) {}
export class TeacherUpdateDto extends createZodDto(teacherUpdateSchema) {}
export class PublicTeacherListDto extends createZodDto(publicTeacherListSchema) {}
