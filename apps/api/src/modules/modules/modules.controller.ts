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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AdminModule, CONTENT_ROLES, type Paginated } from '@onlinedars/shared';
import { Roles } from '../../common/decorators';
import { ModuleInputDto, ModuleUpdateDto, ReorderDto } from './dto';
import { ModulesService } from './modules.service';

@ApiTags('admin: modules')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get('courses/:id/modules')
  @ApiOperation({ summary: 'Modules of a course with lesson summaries' })
  list(@Param('id') courseId: string): Promise<Paginated<AdminModule>> {
    return this.modules.listForCourse(courseId);
  }

  @Post('courses/:id/modules')
  create(@Param('id') courseId: string, @Body() dto: ModuleInputDto): Promise<AdminModule> {
    return this.modules.create(courseId, dto);
  }

  @Patch('courses/:id/modules/reorder')
  @ApiOperation({ summary: 'Reorder modules: ids = every module id in the new order' })
  reorder(@Param('id') courseId: string, @Body() dto: ReorderDto): Promise<Paginated<AdminModule>> {
    return this.modules.reorder(courseId, dto.ids);
  }

  @Patch('modules/:id')
  update(@Param('id') id: string, @Body() dto: ModuleUpdateDto): Promise<AdminModule> {
    return this.modules.update(id, dto);
  }

  @Delete('modules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a module and its lessons' })
  remove(@Param('id') id: string): Promise<void> {
    return this.modules.remove(id);
  }
}
