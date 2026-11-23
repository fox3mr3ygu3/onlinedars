import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminPractice,
  type AdminPracticeDetail,
  CONTENT_ROLES,
  type Paginated,
} from '@onlinedars/shared';
import { Roles } from '../../common/decorators';
import type { ContentDeleteResult } from '../courses/content.utils';
import { PracticeInputDto, PracticeUpdateDto, ReorderDto } from './dto';
import { PracticesService } from './practices.service';

@ApiTags('admin: practices')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin')
export class PracticesController {
  constructor(private readonly practices: PracticesService) {}

  @Get('lessons/:id/practices')
  list(@Param('id') lessonId: string): Promise<Paginated<AdminPractice>> {
    return this.practices.listForLesson(lessonId);
  }

  @Post('lessons/:id/practices')
  @ApiOperation({ summary: 'Add a practice; 409 LESSON_PRACTICE_LIMIT when the lesson has 4' })
  create(@Param('id') lessonId: string, @Body() dto: PracticeInputDto): Promise<AdminPractice> {
    return this.practices.create(lessonId, dto);
  }

  @Patch('lessons/:id/practices/reorder')
  reorder(
    @Param('id') lessonId: string,
    @Body() dto: ReorderDto,
  ): Promise<Paginated<AdminPractice>> {
    return this.practices.reorder(lessonId, dto.ids);
  }

  @Get('practices/:id')
  @ApiOperation({ summary: 'Practice with questions incl. correct answers (staff only)' })
  get(@Param('id') id: string): Promise<AdminPracticeDetail> {
    return this.practices.get(id);
  }

  @Patch('practices/:id')
  update(@Param('id') id: string, @Body() dto: PracticeUpdateDto): Promise<AdminPractice> {
    return this.practices.update(id, dto);
  }

  @Delete('practices/:id')
  @ApiOperation({
    summary: 'Delete a practice; a published lesson is unpublished (lessonUnpublished: true)',
  })
  remove(@Param('id') id: string): Promise<ContentDeleteResult> {
    return this.practices.remove(id);
  }
}
