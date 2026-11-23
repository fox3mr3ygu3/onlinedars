import {
  adminCourseListQuerySchema,
  courseInputSchema,
  courseStatusChangeSchema,
  courseUpdateSchema,
  publicCourseDetailSchema,
  publicLessonPreviewSchema,
  publicCourseListQuerySchema,
  publicCourseListSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class PublicCourseListQueryDto extends createZodDto(publicCourseListQuerySchema) {}
export class PublicCourseListDto extends createZodDto(publicCourseListSchema) {}
export class PublicCourseDetailDto extends createZodDto(publicCourseDetailSchema) {}
export class PublicLessonPreviewDto extends createZodDto(publicLessonPreviewSchema) {}
export class AdminCourseListQueryDto extends createZodDto(adminCourseListQuerySchema) {}
export class CourseInputDto extends createZodDto(courseInputSchema) {}
export class CourseUpdateDto extends createZodDto(courseUpdateSchema) {}
export class CourseStatusChangeDto extends createZodDto(courseStatusChangeSchema) {}
