import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminCourseDetail,
  type AdminCourseListItem,
  type AuthPrincipal,
  CONTENT_ROLES,
  type Paginated,
  type PublicCourseCard,
  type PublicCourseDetail,
  type PublicLessonPreview,
} from '@onlinedars/shared';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AdminCoursesService } from './admin-courses.service';
import { CoursesService } from './courses.service';
import {
  AdminCourseListQueryDto,
  CourseInputDto,
  CourseStatusChangeDto,
  CourseUpdateDto,
  PublicCourseDetailDto,
  PublicLessonPreviewDto,
  PublicCourseListDto,
  PublicCourseListQueryDto,
} from './dto';

@ApiTags('catalog')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catalog: published courses with search, filters and paging' })
  @ApiOkResponse({ type: PublicCourseListDto })
  list(@Query() query: PublicCourseListQueryDto): Promise<Paginated<PublicCourseCard>> {
    return this.courses.listPublic(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Course page: description, goals, program (published only)' })
  @ApiOkResponse({ type: PublicCourseDetailDto })
  get(@Param('slug') slug: string): Promise<PublicCourseDetail> {
    return this.courses.getPublicBySlug(slug);
  }

  @Public()
  @Get(':slug/lessons/:lessonId/preview')
  @ApiOperation({
    summary:
      'Free preview lesson: materials only (published isPreview lesson of a published course; else 404)',
  })
  @ApiOkResponse({ type: PublicLessonPreviewDto })
  preview(
    @Param('slug') slug: string,
    @Param('lessonId') lessonId: string,
  ): Promise<PublicLessonPreview> {
    return this.courses.getLessonPreview(slug, lessonId);
  }
}

@ApiTags('admin: courses')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly courses: AdminCoursesService) {}

  @Get()
  @ApiOperation({ summary: 'All courses (any status) with counters' })
  list(@Query() query: AdminCourseListQueryDto): Promise<Paginated<AdminCourseListItem>> {
    return this.courses.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a course (always DRAFT)' })
  create(
    @Body() dto: CourseInputDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<AdminCourseDetail> {
    return this.courses.create(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Course with modules, lessons and 4×6 readiness per lesson' })
  get(@Param('id') id: string): Promise<AdminCourseDetail> {
    return this.courses.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CourseUpdateDto): Promise<AdminCourseDetail> {
    return this.courses.update(id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Change status. PUBLISHED needs ≥1 lesson and all lessons published (COURSE_INCOMPLETE)',
  })
  setStatus(
    @Param('id') id: string,
    @Body() dto: CourseStatusChangeDto,
  ): Promise<AdminCourseDetail> {
    return this.courses.setStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a course without enrollments/certificates (else COURSE_NOT_DELETABLE)',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.courses.remove(id);
  }
}
