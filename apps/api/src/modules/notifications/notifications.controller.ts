import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type AuthPrincipal,
  type NotificationList,
  notificationListSchema,
  notificationQuerySchema,
  notificationSchema,
  type NotificationView,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles } from '../../common/decorators';
import { NotificationsService } from './notifications.service';

export class NotificationQueryDto extends createZodDto(notificationQuerySchema) {}
export class NotificationListDto extends createZodDto(notificationListSchema) {}
export class NotificationDto extends createZodDto(notificationSchema) {}

/** The signed-in user's own in-app notifications. */
@ApiTags('notifications')
@ApiBearerAuth()
@Roles(Role.STUDENT, Role.CONTENT_MANAGER, Role.ADMIN)
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationListDto })
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationList> {
    return this.notifications.listOwn(user.id, query);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: AuthPrincipal): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: NotificationDto })
  read(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<NotificationView> {
    return this.notifications.markRead(user.id, id);
  }
}
