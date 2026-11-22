import { Module } from '@nestjs/common';
import { AdminCoursesService } from './admin-courses.service';
import { AdminCoursesController, CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController, AdminCoursesController],
  providers: [CoursesService, AdminCoursesService],
  exports: [CoursesService, AdminCoursesService],
})
export class CoursesModule {}
