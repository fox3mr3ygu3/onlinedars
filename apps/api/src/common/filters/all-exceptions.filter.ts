import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, ErrorCode } from '@onlinedars/shared';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { AppException } from '../errors/app.exception';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

/** Turns every error into `{ statusCode, code, message, details? }`. 5xx go to Sentry. */
export function toErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof AppException) {
    const status = exception.getStatus();
    return {
      statusCode: status,
      code: exception.code,
      message: exception.message,
      ...(exception.details !== undefined ? { details: exception.details } : {}),
    };
  }
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError() as { issues?: unknown[] } | undefined;
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      details: zodError?.issues ?? [],
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      statusCode: status,
      code:
        STATUS_CODES[status] ??
        (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_FAILED),
      message: exception.message,
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = toErrorBody(exception);
    if (body.statusCode >= 500) {
      Sentry.captureException(exception);
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(body.statusCode).json(body);
  }
}
