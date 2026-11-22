import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  adminStudentsQuerySchema,
  type AdminStudentListItem,
  type AdminStudentProfile,
  type AuthPrincipal,
  grantEnrollmentSchema,
  type Paginated,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthedRequest, CurrentUser, Roles } from '../../common/decorators';
import { StudentsService } from './students.service';

export class AdminStudentsQueryDto extends createZodDto(adminStudentsQuerySchema) {}
export class GrantEnrollmentDto extends createZodDto(grantEnrollmentSchema) {}

const metaOf = (user: AuthPrincipal, req: AuthedRequest) => ({
  actorId: user.id,
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

@ApiTags('admin: students')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Students list; ?search= matches name, email or phone' })
  @ApiOkResponse({ description: 'Paginated<AdminStudentListItem>' })
  list(@Query() q: AdminStudentsQueryDto): Promise<Paginated<AdminStudentListItem>> {
    return this.students.list(q);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'AdminStudentProfile: profile, enrollments+progress, results, certificates',
  })
  get(@Param('id') id: string): Promise<AdminStudentProfile> {
    return this.students.get(id);
  }

  @Post(':id/enrollments')
  @ApiOperation({ summary: 'Grant course access (audited). 409 ALREADY_ENROLLED' })
  grant(
    @Param('id') id: string,
    @Body() dto: GrantEnrollmentDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthedRequest,
  ) {
    return this.students.grant(id, dto, metaOf(user, req));
  }

  @Delete(':id/enrollments/:courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Revoke course access (audited; progress is kept)' })
  revoke(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    return this.students.revoke(id, courseId, metaOf(user, req));
  }
}
