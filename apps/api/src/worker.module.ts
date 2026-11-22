import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from './config/config.module';
import { AppLoggerModule } from './config/logger.module';
import { CertificatesWorkerModule } from './modules/certificates/certificates.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Background worker (BullMQ processors: certificate-pdf, payment-recheck, notify).
 * Phase 1 agents register their processors here.
 */
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule,
    AppLoggerModule,
    PrismaModule,
    // backend-learning: certificate-pdf
    CertificatesWorkerModule,
  ],
})
export class WorkerModule {}
