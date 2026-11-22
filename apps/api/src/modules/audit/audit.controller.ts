import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type AuditLogView,
  auditLogListSchema,
  auditLogQuerySchema,
  type Paginated,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../../common/decorators';
import { AuditService } from './audit.service';

export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
export class AuditLogListDto extends createZodDto(auditLogListSchema) {}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOkResponse({ type: AuditLogListDto })
  list(@Query() query: AuditLogQueryDto): Promise<Paginated<AuditLogView>> {
    return this.audit.list(query);
  }
}
