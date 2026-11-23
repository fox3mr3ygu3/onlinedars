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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminLessonDetail,
  type AdminLessonMaterial,
  type AdminLessonSummary,
  CONTENT_ROLES,
  type LessonCompletenessResponse,
  type Paginated,
} from '@onlinedars/shared';
import { Roles } from '../../common/decorators';
import {
  LessonCompletenessDto,
  LessonInputDto,
  LessonMaterialInputDto,
  LessonMaterialUpdateDto,
  LessonUpdateDto,
  ReorderDto,
} from './dto';
import { LessonsService } from './lessons.service';

@ApiTags('admin: lessons')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get('modules/:id/lessons')
  list(@Param('id') moduleId: string): Promise<Paginated<AdminLessonSummary>> {
    return this.lessons.listForModule(moduleId);
  }

  @Post('modules/:id/lessons')
  @ApiOperation({ summary: 'Create a lesson (unpublished, appended at the end)' })
  create(@Param('id') moduleId: string, @Body() dto: LessonInputDto): Promise<AdminLessonSummary> {
    return this.lessons.create(moduleId, dto);
  }

  @Patch('modules/:id/lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons: ids = every lesson id of the module in new order' })
  reorder(
    @Param('id') moduleId: string,
    @Body() dto: ReorderDto,
  ): Promise<Paginated<AdminLessonSummary>> {
    return this.lessons.reorder(moduleId, dto.ids);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Lesson with materials, practices and 4×6 completeness' })
  get(@Param('id') id: string): Promise<AdminLessonDetail> {
    return this.lessons.get(id);
  }

  @Patch('lessons/:id')
  update(@Param('id') id: string, @Body() dto: LessonUpdateDto): Promise<AdminLessonSummary> {
    return this.lessons.update(id, dto);
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.lessons.remove(id);
  }

  @Get('lessons/:id/completeness')
  @ApiOperation({ summary: '4×6 counters: practices n/4, questions n/6 per practice, ready' })
  @ApiOkResponse({ type: LessonCompletenessDto })
  completeness(@Param('id') id: string): Promise<LessonCompletenessResponse> {
    return this.lessons.completeness(id);
  }

  @Post('lessons/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish; 409 LESSON_INCOMPLETE (details = counters) unless 4×6' })
  @ApiOkResponse({ type: LessonCompletenessDto })
  publish(@Param('id') id: string): Promise<LessonCompletenessResponse> {
    return this.lessons.publish(id);
  }

  @Post('lessons/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LessonCompletenessDto })
  unpublish(@Param('id') id: string): Promise<LessonCompletenessResponse> {
    return this.lessons.unpublish(id);
  }

  // ---------- materials ----------

  @Get('lessons/:id/materials')
  listMaterials(@Param('id') lessonId: string): Promise<Paginated<AdminLessonMaterial>> {
    return this.lessons.listMaterials(lessonId);
  }

  @Post('lessons/:id/materials')
  @ApiOperation({ summary: 'Add TEXT (sanitised HTML), IMAGE/FILE (uploaded url) or VIDEO (url)' })
  createMaterial(
    @Param('id') lessonId: string,
    @Body() dto: LessonMaterialInputDto,
  ): Promise<AdminLessonMaterial> {
    return this.lessons.createMaterial(lessonId, dto);
  }

  @Patch('lessons/:id/materials/reorder')
  reorderMaterials(
    @Param('id') lessonId: string,
    @Body() dto: ReorderDto,
  ): Promise<Paginated<AdminLessonMaterial>> {
    return this.lessons.reorderMaterials(lessonId, dto.ids);
  }

  @Patch('materials/:id')
  updateMaterial(
    @Param('id') id: string,
    @Body() dto: LessonMaterialUpdateDto,
  ): Promise<AdminLessonMaterial> {
    return this.lessons.updateMaterial(id, dto);
  }

  @Delete('materials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMaterial(@Param('id') id: string): Promise<void> {
    return this.lessons.removeMaterial(id);
  }
}
