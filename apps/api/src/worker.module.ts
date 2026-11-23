import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from './config/config.module';
import { PaymentRecheckJobModule } from './jobs/payment-recheck.job';
import { AppLoggerModule } from './config/logger.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Background worker (BullMQ processors: certificate-pdf, payment-recheck, notify).
 * Phase 1 agents register their processors here; it has none yet.
 */
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule,
    AppLoggerModule,
    PrismaModule,
    PaymentRecheckJobModule,
  ],
})
export class WorkerModule {}
