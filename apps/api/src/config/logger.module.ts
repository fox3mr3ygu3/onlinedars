import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from './app-config';

/** pino logging. JSON in production, pretty in development, silent in tests. Secrets redacted. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.isTest ? 'silent' : config.env.LOG_LEVEL,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.newPassword',
              '*.otpCode',
              '*.code',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            ignore: (req) => (req.url ?? '').startsWith('/api/v1/health'),
          },
          transport:
            !config.isProduction && !config.isTest
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
