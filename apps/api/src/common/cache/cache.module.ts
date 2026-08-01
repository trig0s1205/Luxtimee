import { Global, Module } from '@nestjs/common';
import { MemoryCacheService } from './memory-cache.service';
import { ResponseCacheInterceptor } from './response-cache.interceptor';

@Global()
@Module({
  providers: [MemoryCacheService, ResponseCacheInterceptor],
  exports: [MemoryCacheService, ResponseCacheInterceptor],
})
export class CacheModule {}
