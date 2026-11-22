import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();
  app.get(Logger).log('Worker started (no processors registered yet)');

  // Keep the process alive until BullMQ workers hold their own handles.
  const keepAlive = setInterval(() => undefined, 1 << 30);
  const stop = async () => {
    clearInterval(keepAlive);
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}

void bootstrap();
