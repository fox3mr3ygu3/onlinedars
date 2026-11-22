import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthPrincipal,
  type LessonViewedResult,
  type Paginated,
  type PracticeResult,
  Role,
  type StudentCourseItem,
  type StudentCourseTree,
  type StudentDashboard,
  type StudentLessonView,
  type StudentPracticeView,
} from '@onlinedars/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { DashboardService } from './dashboard.service';
import { PaginationQueryDto, PracticeSubmitDto } from './dto';
import { ProgressService } from './progress.service';

/** Student learning endpoints. Every query is scoped to the caller's own user id. */
@ApiTags('me: learning')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('me')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Student dashboard: stats, courses with progress, last activity' })
  @ApiOkResponse({ description: 'StudentDashboard' })
  getDashboard(@CurrentUser() user: AuthPrincipal): Promise<StudentDashboard> {
    return this.dashboard.getDashboard(user.id);
  }

  @Get('courses')
  @ApiOperation({ summary: 'My enrolled courses with progress' })
  @ApiOkResponse({ description: 'Paginated<StudentCourseItem>' })
  listCourses(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<StudentCourseItem>> {
    return this.dashboard.listCourses(user.id, query);
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Course tree with lock state and progress (enrolled only)' })
  @ApiOkResponse({ description: 'StudentCourseTree' })
  getCourse(
    @CurrentUser() user: AuthPrincipal,
    @Param('courseId') courseId: string,
  ): Promise<StudentCourseTree> {
    return this.progress.getCourseTree(user.id, courseId);
  }

  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'Lesson materials + practice summaries (403 LESSON_LOCKED if locked)' })
  @ApiOkResponse({ description: 'StudentLessonView' })
  getLesson(
    @CurrentUser() user: AuthPrincipal,
    @Param('lessonId') lessonId: string,
  ): Promise<StudentLessonView> {
    return this.progress.getLesson(user.id, lessonId);
  }

  @Post('lessons/:lessonId/viewed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark lesson material as viewed (idempotent)' })
  @ApiOkResponse({ description: 'LessonViewedResult' })
  markViewed(
    @CurrentUser() user: AuthPrincipal,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonViewedResult> {
    return this.progress.markViewed(user.id, lessonId);
  }

  @Get('practices/:practiceId')
  @ApiOperation({ summary: 'Practice questions without correct answers + my attempts' })
  @ApiOkResponse({ description: 'StudentPracticeView' })
  getPractice(
    @CurrentUser() user: AuthPrincipal,
    @Param('practiceId') practiceId: string,
  ): Promise<StudentPracticeView> {
    return this.progress.getPractice(user.id, practiceId);
  }

  @Post('practices/:practiceId/attempts')
  @ApiOperation({ summary: 'Submit practice answers; graded on the server, returns explanations' })
  @ApiOkResponse({ description: 'PracticeResult' })
  submitPractice(
    @CurrentUser() user: AuthPrincipal,
    @Param('practiceId') practiceId: string,
    @Body() dto: PracticeSubmitDto,
  ): Promise<PracticeResult> {
    return this.progress.submitPractice(user.id, practiceId, dto);
  }
}
