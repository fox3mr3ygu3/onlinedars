import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthPrincipal,
  type PlatformSettings,
  platformSettingsSchema,
  platformSettingsUpdateSchema,
  type PublicPlatformSettings,
  Role,
} from '@onlinedars/shared';
import type { Request } from 'express';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { SettingsService } from './settings.service';

class PlatformSettingsDto extends createZodDto(platformSettingsSchema) {}
class PlatformSettingsUpdateDto extends createZodDto(platformSettingsUpdateSchema) {}

@ApiTags('admin: settings')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'All platform settings (ADMIN only)' })
  @ApiOkResponse({ type: PlatformSettingsDto })
  get(): Promise<PlatformSettings> {
    return this.settings.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update any subset of settings; written to the audit log' })
  @ApiOkResponse({ type: PlatformSettingsDto })
  update(
    @Body() dto: PlatformSettingsUpdateDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ): Promise<PlatformSettings> {
    return this.settings.update(dto, user, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 500),
    });
  }
}

@ApiTags('catalog')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Non-sensitive settings for the public site (name, contacts, banner)' })
  getPublic(): Promise<PublicPlatformSettings> {
    return this.settings.getPublic();
  }
}
