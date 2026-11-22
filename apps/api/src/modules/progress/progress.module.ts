import { Module } from '@nestjs/common';
import { CourseStateService } from './course-state.service';
import { DashboardService } from './dashboard.service';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  controllers: [ProgressController],
  providers: [CourseStateService, ProgressService, DashboardService],
  exports: [CourseStateService, ProgressService, DashboardService],
})
export class ProgressModule {}
