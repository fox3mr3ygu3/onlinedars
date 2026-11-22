import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { CertificatePdfService } from '../modules/certificates/certificate-pdf.service';
import {
  CERTIFICATE_PDF_QUEUE,
  type CertificatePdfJobData,
  redisConnectionFromUrl,
  redisUrlFromEnv,
} from './certificate-pdf.queue';

/** Handles one `certificate-pdf` job. Exported for unit tests. */
export async function processCertificatePdfJob(
  pdf: Pick<CertificatePdfService, 'generate'>,
  job: Pick<Job<CertificatePdfJobData>, 'data'>,
): Promise<{ key: string }> {
  const key = await pdf.generate(job.data.certificateId);
  return { key };
}

/** BullMQ consumer, started by the worker process only. */
@Injectable()
export class CertificatePdfProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CertificatePdfProcessor.name);
  private worker: Worker<CertificatePdfJobData> | null = null;

  constructor(private readonly pdf: CertificatePdfService) {}

  onModuleInit(): void {
    const url = redisUrlFromEnv();
    if (!url) {
      this.logger.warn('REDIS_URL not set: certificate-pdf worker idle (API renders inline)');
      return;
    }
    this.worker = new Worker<CertificatePdfJobData>(
      CERTIFICATE_PDF_QUEUE,
      (job) => processCertificatePdfJob(this.pdf, job),
      { connection: redisConnectionFromUrl(url), concurrency: 2 },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`certificate-pdf job ${job?.id ?? '?'} failed: ${err.message}`),
    );
    this.logger.log('certificate-pdf worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
