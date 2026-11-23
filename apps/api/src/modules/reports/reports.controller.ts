import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ActivityReportDay,
  type AdminDashboardStats,
  type CourseReportRow,
  type ExamReportRow,
  reportRangeQuerySchema,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../../common/decorators';
import { ReportsService } from './reports.service';

export class ReportRangeQueryDto extends createZodDto(reportRangeQuerySchema) {}

@ApiTags('admin: reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard totals + recent exam results' })
  @ApiOkResponse({ description: 'AdminDashboardStats' })
  dashboard(): Promise<AdminDashboardStats> {
    return this.reports.dashboard();
  }

  @Get('reports/courses')
  @ApiOperation({ summary: 'Per-course enrollments, completion, certificates' })
  @ApiOkResponse({ description: 'CourseReportRow[]' })
  courses(@Query() q: ReportRangeQueryDto): Promise<CourseReportRow[]> {
    return this.reports.courses(q);
  }

  @Get('reports/exams')
  @ApiOperation({ summary: 'Per-exam attempts, pass rate, average % (attempts started in range)' })
  exams(
    @Query() q: ReportRangeQueryDto,
  ): Promise<{ from: string; to: string; items: ExamReportRow[] }> {
    return this.reports.exams(q);
  }

  @Get('reports/activity')
  @ApiOperation({ summary: 'Daily activity (Asia/Tashkent days), default last 30 days' })
  activity(
    @Query() q: ReportRangeQueryDto,
  ): Promise<{ from: string; to: string; days: ActivityReportDay[] }> {
    return this.reports.activity(q);
  }
}
