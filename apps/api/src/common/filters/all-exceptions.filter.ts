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

function extractHttpMessage(response: string | object): string | string[] {
  if (typeof response === 'string') return response;

  if (response && typeof response === 'object') {
    const msg = (response as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) {
      return msg.filter((item): item is string => typeof item === 'string');
    }
    if (msg && typeof msg === 'object' && 'message' in msg) {
      const inner = (msg as { message?: unknown }).message;
      if (typeof inner === 'string') return inner;
      if (Array.isArray(inner)) {
        return inner.filter((item): item is string => typeof item === 'string');
      }
    }
  }

  return 'Error en la solicitud';
}

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

    let message: string | string[] =
      exception instanceof HttpException
        ? extractHttpMessage(exception.getResponse())
        : isProd
          ? 'Error interno del servidor'
          : exception instanceof Error
            ? exception.message
            : 'Error interno del servidor';

    const preserveUpstream =
      exception instanceof HttpException
      && (
        status === HttpStatus.BAD_GATEWAY
        || status === HttpStatus.SERVICE_UNAVAILABLE
        || status === HttpStatus.GATEWAY_TIMEOUT
      );

    if (isProd && isPrisma) {
      this.logger.error(exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
    } else if (isProd && status >= 500 && !preserveUpstream) {
      this.logger.error(exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
    } else if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
