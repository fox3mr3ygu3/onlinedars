import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { ProgressModule } from '../progress/progress.module';
import { AdminExamsService } from './admin-exams.service';
import { AdminExamsController, MeExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [ProgressModule, CertificatesModule],
  controllers: [MeExamsController, AdminExamsController],
  providers: [ExamsService, AdminExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
