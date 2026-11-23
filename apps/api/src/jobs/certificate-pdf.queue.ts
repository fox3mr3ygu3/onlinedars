import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CertificatePdfService } from '../modules/certificates/certificate-pdf.service';

export const CERTIFICATE_PDF_QUEUE = 'certificate-pdf';

export interface CertificatePdfJobData {
  certificateId: string;
}

/** Schedules PDF rendering for an issued certificate. */
export abstract class CertificatePdfQueue {
  abstract enqueue(certificateId: string): Promise<void>;
}

/**
 * Redis URL from the raw environment. AppConfig gives REDIS_URL a localhost default, so we
 * look at the real variable: when it is not set (local dev without Redis, unit tests) PDF jobs
 * run inline in the API process instead of BullMQ.
 */
export function redisUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const v = env.REDIS_URL?.trim();
  return v ? v : undefined;
}

/** ioredis connection options from a redis:// or rediss:// URL (no extra dependency). */
export function redisConnectionFromUrl(url: string) {
  const u = new URL(url);
  const db = u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0;
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ workers (blocking commands).
    maxRetriesPerRequest: null,
  };
}

/** Runs the job in-process. Errors are logged, never thrown (an exam submit must not fail). */
@Injectable()
export class InlineCertificatePdfQueue extends CertificatePdfQueue {
  private readonly logger = new Logger(InlineCertificatePdfQueue.name);

  constructor(private readonly pdf: CertificatePdfService) {
    super();
  }

  async enqueue(certificateId: string): Promise<void> {
    try {
      await this.pdf.generate(certificateId);
    } catch (err) {
      this.logger.error(`Inline certificate PDF failed for ${certificateId}: ${String(err)}`);
    }
  }
}

/** Pushes to BullMQ; the worker process (`dist/worker.js`) renders the PDF. */
export class BullmqCertificatePdfQueue extends CertificatePdfQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BullmqCertificatePdfQueue.name);
  private readonly queue: Queue<CertificatePdfJobData>;

  constructor(redisUrl: string) {
    super();
    this.queue = new Queue<CertificatePdfJobData>(CERTIFICATE_PDF_QUEUE, {
      connection: redisConnectionFromUrl(redisUrl),
    });
  }

  async enqueue(certificateId: string): Promise<void> {
    try {
      await this.queue.add(
        'render',
        { certificateId },
        {
          // One job per certificate: re-enqueueing while it's pending is a no-op.
          jobId: `certificate-${certificateId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (err) {
      // Redis down: the student can still download later (re-enqueued on download).
      this.logger.error(`Could not enqueue certificate PDF ${certificateId}: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
