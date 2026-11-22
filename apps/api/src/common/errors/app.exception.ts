import { HttpException, HttpStatus } from '@nestjs/common';
import { type ErrorCode, ErrorCode as Codes } from '@onlinedars/shared';

/**
 * HTTP exception with a stable `code` (see packages/shared/src/errors.ts).
 * The web maps `code` to an i18n message; `message` is for logs/developers only.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message?: string,
    readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message: message ?? code, details }, status);
  }

  static unauthorized(code: ErrorCode = Codes.UNAUTHORIZED, message?: string) {
    return new AppException(code, HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(code: ErrorCode = Codes.FORBIDDEN, message?: string) {
    return new AppException(code, HttpStatus.FORBIDDEN, message);
  }

  static notFound(code: ErrorCode = Codes.NOT_FOUND, message?: string) {
    return new AppException(code, HttpStatus.NOT_FOUND, message);
  }

  static conflict(code: ErrorCode = Codes.CONFLICT, message?: string) {
    return new AppException(code, HttpStatus.CONFLICT, message);
  }

  static badRequest(code: ErrorCode, message?: string, details?: unknown) {
    return new AppException(code, HttpStatus.BAD_REQUEST, message, details);
  }

  static tooMany(code: ErrorCode = Codes.TOO_MANY_REQUESTS, message?: string) {
    return new AppException(code, HttpStatus.TOO_MANY_REQUESTS, message);
  }
}
