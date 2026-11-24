import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminAccessRequest,
  type AdminAccessRequestList,
  adminAccessRequestsQuerySchema,
  type AuthPrincipal,
  type CourseAccessState,
  createAccessRequestSchema,
  type MyAccessRequest,
  rejectAccessRequestSchema,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthedRequest, CurrentUser, Roles } from '../../common/decorators';
import { AccessRequestsService } from './access-requests.service';

export class CreateAccessRequestDto extends createZodDto(createAccessRequestSchema) {}
export class AdminAccessRequestsQueryDto extends createZodDto(adminAccessRequestsQuerySchema) {}
export class RejectAccessRequestDto extends createZodDto(rejectAccessRequestSchema) {}

const metaOf = (user: AuthPrincipal, req: AuthedRequest) => ({
  actorId: user.id,
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

/** Students ask for a course. Staff have no cabinet, so they can't request (403). */
@ApiTags('access requests')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller()
export class AccessRequestsController {
  constructor(private readonly requests: AccessRequestsService) {}

  @Post('access-requests')
  @ApiOperation({
    summary:
      'Ask an admin for access to a published course. 409 ALREADY_ENROLLED / ACCESS_REQUEST_PENDING',
  })
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateAccessRequestDto,
  ): Promise<MyAccessRequest> {
    return this.requests.request(user, dto);
  }

  @Get('me/access-requests')
  @ApiOperation({ summary: "The signed-in student's own access requests, newest first" })
  listOwn(@CurrentUser() user: AuthPrincipal): Promise<MyAccessRequest[]> {
    return this.requests.listOwn(user);
  }

  @Get('me/course-access/:courseId')
  @ApiOperation({ summary: 'Course page state: enrolled, or the own request for this course' })
  courseAccess(
    @CurrentUser() user: AuthPrincipal,
    @Param('courseId') courseId: string,
  ): Promise<CourseAccessState> {
    return this.requests.courseAccess(user, courseId);
  }
}

/** The admin queue of access requests. Every decision is audited and notifies the student. */
@ApiTags('admin: access requests')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/access-requests')
export class AdminAccessRequestsController {
  constructor(private readonly requests: AccessRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Requests (filter by status, course, search) + pendingCount' })
  @ApiOkResponse({ description: 'AdminAccessRequestList' })
  list(@Query() q: AdminAccessRequestsQueryDto): Promise<AdminAccessRequestList> {
    return this.requests.list(q);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve: grants the course. 409 ACCESS_REQUEST_DECIDED' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthedRequest,
  ): Promise<AdminAccessRequest> {
    return this.requests.approve(id, metaOf(user, req));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject with a reason the student sees. 409 ACCESS_REQUEST_DECIDED' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAccessRequestDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthedRequest,
  ): Promise<AdminAccessRequest> {
    return this.requests.reject(id, dto, metaOf(user, req));
  }
}
