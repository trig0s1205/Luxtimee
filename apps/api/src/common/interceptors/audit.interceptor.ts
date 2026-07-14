import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_KEY } from '../decorators/metadata.decorators';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<{ action: string; entity: string }>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;
    const entityId = request.params?.id;

    return next.handle().pipe(
      tap(async (result) => {
        if (!user?.id) return;
        await this.auditService.log({
          userId: user.id,
          action: auditMeta.action,
          entity: auditMeta.entity,
          entityId: entityId ?? (result as { id?: string })?.id,
          diff: { body, result },
        });
      }),
    );
  }
}
