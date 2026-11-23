import {
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { AppConfig } from '../config/app-config';
import { PaymentsCoreModule } from '../modules/payments/core/payments-core.module';
import { PaymentRecheckService } from '../modules/payments/core/payment-recheck.service';

export const PAYMENT_RECHECK_QUEUE = 'payment-recheck';
const SCHEDULER_ID = 'payment-recheck-every';

/** redis://[:password@]host:port[/db] (rediss:// → TLS) → BullMQ/ioredis connection options. */
export function redisConnectionFromUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  const db = u.pathname.replace('/', '');
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(db ? { db: Number(db) } : {}),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

/**
 * Schedules PaymentRecheckService.run() every PAYMENT_RECHECK_INTERVAL_MINUTES in the worker.
 * - REDIS_URL set in the environment → BullMQ queue `payment-recheck` with a job scheduler
 *   (one run at a time across worker replicas).
 * - REDIS_URL not set → plain in-process interval (dev without Redis).
 * - interval 0 → disabled.
 */
@Injectable()
export class PaymentRecheckJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRecheckJob.name);
  private queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: AppConfig,
    private readonly recheck: PaymentRecheckService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const minutes = this.config.env.PAYMENT_RECHECK_INTERVAL_MINUTES;
    if (minutes <= 0) {
      this.logger.log('payment re-check disabled (PAYMENT_RECHECK_INTERVAL_MINUTES=0)');
      return;
    }
    const every = minutes * 60_000;
    const redisUrl = this.config.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set: running payment re-check in-process');
      this.timer = setInterval(() => void this.runSafely(), every);
      return;
    }
    const connection = redisConnectionFromUrl(redisUrl);
    this.queue = new Queue(PAYMENT_RECHECK_QUEUE, { connection });
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every },
      { name: 'recheck', opts: { removeOnComplete: 100, removeOnFail: 100 } },
    );
    this.worker = new Worker(PAYMENT_RECHECK_QUEUE, () => this.recheck.run(), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (_job, err) =>
      this.logger.error(`payment re-check failed: ${err.message}`),
    );
    this.logger.log(`payment re-check scheduled every ${minutes} min`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }

  private async runSafely(): Promise<void> {
    try {
      await this.recheck.run();
    } catch (err) {
      this.logger.error(`payment re-check failed: ${String(err)}`);
    }
  }
}

@Module({
  imports: [PaymentsCoreModule],
  providers: [PaymentRecheckJob],
})
export class PaymentRecheckJobModule {}
