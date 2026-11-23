import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AuthPrincipal,
  type ExamAttemptView,
  type ExamSubmitResult,
  type Paginated,
  Role,
  type StudentExamStatus,
  type StudentResultItem,
} from '@onlinedars/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { PaginationQueryDto } from '../progress/dto';
import {
  type AdminExamConfig,
  type AdminExamQuestion,
  AdminExamsService,
} from './admin-exams.service';
import { ExamAutosaveDto, ExamConfigDto, ExamQuestionDto, ExamSubmitDto } from './dto';
import { ExamsService } from './exams.service';

@ApiTags('me: exams')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('me')
export class MeExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get('courses/:courseId/exam')
  @ApiOperation({ summary: 'Exam status: config, lock state, attempts, last result' })
  @ApiOkResponse({ description: 'StudentExamStatus' })
  status(
    @CurrentUser() user: AuthPrincipal,
    @Param('courseId') courseId: string,
  ): Promise<StudentExamStatus> {
    return this.exams.getStatus(user.id, courseId);
  }

  @Post('courses/:courseId/exam/attempts')
  @ApiOperation({
    summary: 'Start (or resume) a timed attempt; questions without answers + expiresAt',
  })
  @ApiOkResponse({ description: 'ExamAttemptView; 403 EXAM_LOCKED / EXAM_ATTEMPTS_EXHAUSTED' })
  start(
    @CurrentUser() user: AuthPrincipal,
    @Param('courseId') courseId: string,
  ): Promise<ExamAttemptView> {
    return this.exams.startAttempt(user.id, courseId);
  }

  @Get('exam-attempts/:attemptId')
  @ApiOperation({ summary: 'Running attempt (view) or finished attempt (result)' })
  getAttempt(
    @CurrentUser() user: AuthPrincipal,
    @Param('attemptId') attemptId: string,
  ): Promise<ExamAttemptView | ExamSubmitResult> {
    return this.exams.getAttempt(user.id, attemptId);
  }

  @Put('exam-attempts/:attemptId/answers')
  @ApiOperation({ summary: 'Autosave answers of a running attempt (replaces saved answers)' })
  autosave(
    @CurrentUser() user: AuthPrincipal,
    @Param('attemptId') attemptId: string,
    @Body() dto: ExamAutosaveDto,
  ): Promise<{ savedAt: string }> {
    return this.exams.autosave(user.id, attemptId, dto.answers);
  }

  @Post('exam-attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit; graded on the server. 409 EXAM_TIME_OVER after deadline+grace',
  })
  @ApiOkResponse({ description: 'ExamSubmitResult' })
  submit(
    @CurrentUser() user: AuthPrincipal,
    @Param('attemptId') attemptId: string,
    @Body() dto: ExamSubmitDto,
  ): Promise<ExamSubmitResult> {
    return this.exams.submit(user.id, attemptId, dto.answers);
  }

  @Get('results')
  @ApiOperation({ summary: 'My finished exam attempts, newest first' })
  @ApiOkResponse({ description: 'Paginated<StudentResultItem>' })
  results(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<StudentResultItem>> {
    return this.exams.listResults(user.id, query);
  }
}

@ApiTags('admin: exams')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.CONTENT_MANAGER)
@Controller('admin/courses/:courseId/exam')
export class AdminExamsController {
  constructor(private readonly exams: AdminExamsService) {}

  @Get()
  @ApiOkResponse({ description: 'AdminExamConfig (exam null if not configured)' })
  get(@Param('courseId') courseId: string): Promise<AdminExamConfig> {
    return this.exams.getConfig(courseId);
  }

  @Put()
  @ApiOperation({ summary: 'Create/update exam: question count, time limit, pass score' })
  put(@Param('courseId') courseId: string, @Body() dto: ExamConfigDto): Promise<AdminExamConfig> {
    return this.exams.upsertConfig(courseId, dto);
  }

  @Get('questions')
  listQuestions(
    @Param('courseId') courseId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<AdminExamQuestion>> {
    return this.exams.listQuestions(courseId, query);
  }

  @Post('questions')
  createQuestion(
    @Param('courseId') courseId: string,
    @Body() dto: ExamQuestionDto,
  ): Promise<AdminExamQuestion> {
    return this.exams.createQuestion(courseId, dto);
  }

  @Put('questions/:questionId')
  updateQuestion(
    @Param('courseId') courseId: string,
    @Param('questionId') questionId: string,
    @Body() dto: ExamQuestionDto,
  ): Promise<AdminExamQuestion> {
    return this.exams.updateQuestion(courseId, questionId, dto);
  }

  @Delete('questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteQuestion(
    @Param('courseId') courseId: string,
    @Param('questionId') questionId: string,
  ): Promise<void> {
    return this.exams.deleteQuestion(courseId, questionId);
  }
}
