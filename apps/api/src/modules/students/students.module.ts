import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { ProgressModule } from '../progress/progress.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [ProgressModule, CertificatesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
