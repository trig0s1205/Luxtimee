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

function multerUploadMessage(exception: unknown): string | null {
  if (!exception || typeof exception !== 'object') return null;
  const named = exception as { name?: string; code?: string };
  if (named.name !== 'MulterError') return null;
  if (named.code === 'LIMIT_FILE_SIZE') {
    return 'El archivo pesa demasiado.';
  }
  if (named.code === 'LIMIT_FILE_COUNT' || named.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'Se enviaron más archivos de los permitidos.';
  }
  return 'No se pudo recibir el archivo.';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const uploadMessage = multerUploadMessage(exception);
    if (uploadMessage) {
      this.logger.warn('upload_rejected reason=request');
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: uploadMessage,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const isPrisma =
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientInitializationError;

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] =
      exception instanceof HttpException
        ? extractHttpMessage(exception.getResponse())
        : 'Error interno del servidor';

    const preserveUpstream =
      exception instanceof HttpException &&
      (status === HttpStatus.BAD_GATEWAY ||
        status === HttpStatus.SERVICE_UNAVAILABLE ||
        status === HttpStatus.GATEWAY_TIMEOUT);

    if (status >= 500) {
      this.logger.error(
        `request_failed status=${status} type=${exception instanceof Error ? exception.name : 'unknown'}`,
      );
    }

    if (isPrisma || (status >= 500 && !preserveUpstream)) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
