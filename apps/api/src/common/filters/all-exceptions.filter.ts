import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProd = process.env.NODE_ENV === 'production';

    const isPrisma =
      exception instanceof Prisma.PrismaClientKnownRequestError
      || exception instanceof Prisma.PrismaClientValidationError
      || exception instanceof Prisma.PrismaClientInitializationError;

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor';

    if (isProd && (status >= 500 || isPrisma)) {
      this.logger.error(exception);
      status = status >= 500 || isPrisma ? HttpStatus.INTERNAL_SERVER_ERROR : status;
      message = 'Error interno del servidor';
    } else if (status >= 500) {
      this.logger.error(exception);
      if (typeof message === 'object' && message !== null && 'message' in message) {
        const safe = { ...(message as Record<string, unknown>) };
        delete safe.stack;
        message = safe;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
