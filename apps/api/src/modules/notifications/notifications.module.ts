import { Module } from '@nestjs/common';
import {
  EmailSender,
  NoopEmailSender,
  NoopNotificationSmsSender,
  NotificationSmsSender,
} from './channels';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // Swap for real providers when email/SMS notifications are enabled (docs/USER_ACTIONS.md).
    { provide: EmailSender, useClass: NoopEmailSender },
    { provide: NotificationSmsSender, useClass: NoopNotificationSmsSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
