import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, of, tap } from 'rxjs';
import { CACHEABLE_KEY, type CacheableOptions } from './cache.decorator';
import { MemoryCacheService } from './memory-cache.service';

@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: MemoryCacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<CacheableOptions | undefined>(
      CACHEABLE_KEY,
      context.getHandler(),
    );
    if (!options) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') return next.handle();

    const res = context.switchToHttp().getResponse<Response>();
    const cacheKey = this.buildKey(req);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      this.setCacheHeaders(res, options);
      return of(cached);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(cacheKey, data, options.ttlMs, options.tag);
        this.setCacheHeaders(res, options);
      }),
    );
  }

  private buildKey(req: Request) {
    const query = new URLSearchParams(
      Object.entries(req.query as Record<string, string>)
        .filter(([, value]) => value !== undefined && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    return query ? `${req.path}?${query}` : req.path;
  }

  private setCacheHeaders(res: Response, options: CacheableOptions) {
    const maxAge = options.maxAge ?? Math.max(1, Math.floor(options.ttlMs / 1000));
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=30`);
  }
}
