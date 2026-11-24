import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AccessRequestsController,
  AdminAccessRequestsController,
} from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AccessRequestsController, AdminAccessRequestsController],
  providers: [AccessRequestsService],
})
export class AccessRequestsModule {}
