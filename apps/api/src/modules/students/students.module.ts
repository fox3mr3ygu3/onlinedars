import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressModule } from '../progress/progress.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [ProgressModule, CertificatesModule, NotificationsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
