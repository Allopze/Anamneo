import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SentryExceptionCaptured } from '@sentry/nestjs';

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

      console.error(
        JSON.stringify({
          level: 'error',
          event: 'unhandled_exception',
          method: request.method,
          path: request.originalUrl,
          message: errMsg,
          ...(this.isProduction ? {} : { stack }),
        }),
      );

      // In production, never expose internal details
      if (!this.isProduction) {
        message = errMsg;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
