import { resolve } from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AdminFilesController, PublicFilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalDiskStorageService } from './storage/local-disk-storage.service';
import { MemoryStorageService } from './storage/memory-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { type StorageDriver, StorageService } from './storage/storage.service';

/**
 * Picks the storage driver:
 * - `STORAGE_DRIVER=s3|local|memory` wins when set;
 * - otherwise S3 when `S3_ENDPOINT` is set in the environment (not just the config default),
 *   memory under NODE_ENV=test, else local disk (`UPLOAD_DIR`, default `<cwd>/.uploads`).
 */
export function chooseDriver(env: NodeJS.ProcessEnv): StorageDriver {
  const forced = env.STORAGE_DRIVER?.trim().toLowerCase();
  if (forced === 's3' || forced === 'local' || forced === 'memory') return forced;
  if (env.NODE_ENV === 'test') return 'memory';
  return env.S3_ENDPOINT?.trim() ? 's3' : 'local';
}

export function createStorage(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): StorageService {
  const driver = chooseDriver(env);
  const filesBase = `${config.env.API_URL.replace(/\/+$/, '')}/files`;
  switch (driver) {
    case 's3':
      return new S3StorageService({
        endpoint: config.env.S3_ENDPOINT,
        region: env.S3_REGION?.trim() || 'us-east-1',
        bucket: config.env.S3_BUCKET,
        accessKey: config.env.S3_ACCESS_KEY,
        secretKey: config.env.S3_SECRET_KEY,
        publicUrl: config.env.S3_PUBLIC_URL,
      });
    case 'memory':
      return new MemoryStorageService(filesBase);
    case 'local':
    default:
      return new LocalDiskStorageService(
        env.UPLOAD_DIR?.trim() || resolve(process.cwd(), '.uploads'),
        filesBase,
      );
  }
}

@Module({
  controllers: [AdminFilesController, PublicFilesController],
  providers: [
    {
      provide: StorageService,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const storage = createStorage(config);
        new Logger('FilesModule').log(`Storage driver: ${storage.driver}`);
        return storage;
      },
    },
    FilesService,
  ],
  exports: [StorageService, FilesService],
})
export class FilesModule {}
