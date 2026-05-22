import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { scrubPhi } from '../utils/phi-scrub';
import { sanitizeRequestPath } from '../utils/request-tracing';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || message;
        error = resp.error || error;
      }
    } else {
      // Non-HTTP exceptions: log full details server-side
      const errMsg =
        exception instanceof Error ? exception.message : 'Unknown error';
      const stack =
        exception instanceof Error ? exception.stack : undefined;
      const sanitizedMessage = scrubPhi(errMsg) ?? 'Unknown error';
      const sanitizedStack = scrubPhi(stack);
      const sanitizedPath = sanitizeRequestPath(request.originalUrl);

      console.error(
        JSON.stringify({
          level: 'error',
          event: 'unhandled_exception',
          method: request.method,
          path: sanitizedPath,
          message: sanitizedMessage,
          ...(this.isProduction ? {} : { stack: sanitizedStack }),
        }),
      );

      // In production, never expose internal details
      if (!this.isProduction) {
        message = sanitizedMessage;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: sanitizeRequestPath(request.originalUrl),
    });
  }
}
