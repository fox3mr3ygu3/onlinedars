import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE_NAME } from '@onlinedars/shared';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppConfig } from './config/app-config';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/** Shared HTTP setup for main.ts and e2e tests, so tests run against the real configuration. */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;

  app.useLogger(app.get(Logger));
  // Behind Caddy: trust the first proxy hop for req.ip / secure cookies.
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.enableShutdownHooks();

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OnlineDars API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth(REFRESH_COOKIE_NAME)
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, cleanupOpenApiDoc(doc), {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
  });
}
