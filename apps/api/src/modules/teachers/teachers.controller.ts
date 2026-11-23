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
  type AdminTeacher,
  CONTENT_ROLES,
  type Paginated,
  type PublicTeacher,
} from '@onlinedars/shared';
import { Public, Roles } from '../../common/decorators';
import {
  AdminListQueryDto,
  PublicListQueryDto,
  PublicTeacherListDto,
  TeacherInputDto,
  TeacherUpdateDto,
} from './dto';
import { TeachersService } from './teachers.service';

@ApiTags('catalog')
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active teachers with published course counts' })
  @ApiOkResponse({ type: PublicTeacherListDto })
  list(@Query() query: PublicListQueryDto): Promise<Paginated<PublicTeacher>> {
    return this.teachers.listPublic(query);
  }
}

@ApiTags('admin: teachers')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin/teachers')
export class AdminTeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  list(@Query() query: AdminListQueryDto): Promise<Paginated<AdminTeacher>> {
    return this.teachers.listAdmin(query);
  }

  @Post()
  create(@Body() dto: TeacherInputDto): Promise<AdminTeacher> {
    return this.teachers.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminTeacher> {
    return this.teachers.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: TeacherUpdateDto): Promise<AdminTeacher> {
    return this.teachers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.teachers.remove(id);
  }
}
