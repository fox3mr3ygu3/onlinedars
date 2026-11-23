import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AdminQuestion, CONTENT_ROLES, type Paginated } from '@onlinedars/shared';
import { Roles } from '../../common/decorators';
import type { ContentDeleteResult } from '../courses/content.utils';
import { QuestionInputDto, QuestionUpdateDto, ReorderDto } from './dto';
import { QuestionsService } from './questions.service';

@ApiTags('admin: questions')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('practices/:id/questions')
  @ApiOperation({ summary: 'Questions with options and correct answers (staff only)' })
  list(@Param('id') practiceId: string): Promise<Paginated<AdminQuestion>> {
    return this.questions.listForPractice(practiceId);
  }

  @Post('practices/:id/questions')
  @ApiOperation({ summary: 'Add a question; 409 PRACTICE_QUESTION_LIMIT when it has 6' })
  create(@Param('id') practiceId: string, @Body() dto: QuestionInputDto): Promise<AdminQuestion> {
    return this.questions.create(practiceId, dto);
  }

  @Patch('practices/:id/questions/reorder')
  reorder(
    @Param('id') practiceId: string,
    @Body() dto: ReorderDto,
  ): Promise<Paginated<AdminQuestion>> {
    return this.questions.reorder(practiceId, dto.ids);
  }

  @Get('questions/:id')
  get(@Param('id') id: string): Promise<AdminQuestion> {
    return this.questions.get(id);
  }

  @Patch('questions/:id')
  @ApiOperation({
    summary: 'Partial update; `options` replaces all options; merged shape re-validated',
  })
  update(@Param('id') id: string, @Body() dto: QuestionUpdateDto): Promise<AdminQuestion> {
    return this.questions.update(id, dto);
  }

  @Delete('questions/:id')
  @ApiOperation({
    summary: 'Delete a question; a published lesson is unpublished (lessonUnpublished: true)',
  })
  remove(@Param('id') id: string): Promise<ContentDeleteResult> {
    return this.questions.remove(id);
  }
}
