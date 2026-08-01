import { Controller, Get, Logger, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CACHE_TAGS, Cacheable } from '../common/cache/cache.decorator';
import { Public } from '../common/decorators/metadata.decorators';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';
import { WholesaleAccessGuard } from '../common/guards/wholesale-access.guard';

@Controller({ path: 'catalog', version: '1' })
@Public()
@UseInterceptors(FinancialStripInterceptor)
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private catalogService: CatalogService) {}

  @Get()
  @Cacheable({ ttlMs: 60_000, tag: CACHE_TAGS.catalog, maxAge: 60 })
  list(@Query() query: CatalogQueryDto) {
    this.logger.log(`[catalog:list] params=${JSON.stringify(query)}`);
    return this.catalogService.list(query);
  }

  @Get('best-sellers')
  @Cacheable({ ttlMs: 120_000, tag: CACHE_TAGS.catalog, maxAge: 120 })
  bestSellers(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const safeLimit = Number.isFinite(parsed) ? Math.min(12, Math.max(1, parsed)) : 6;
    return this.catalogService.findBestSellers(safeLimit);
  }

  @Get('featured')
  @Cacheable({ ttlMs: 120_000, tag: CACHE_TAGS.catalog, maxAge: 120 })
  featured(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const safeLimit = Number.isFinite(parsed) ? Math.min(24, Math.max(1, parsed)) : 12;
    return this.catalogService.findFeatured(safeLimit);
  }

  @Get('new-arrivals')
  @Cacheable({ ttlMs: 120_000, tag: CACHE_TAGS.catalog, maxAge: 120 })
  newArrivals() {
    return this.catalogService.findNewArrivals();
  }

  @Get('wholesale')
  @UseGuards(WholesaleAccessGuard)
  listWholesale(@Query() query: CatalogQueryDto) {
    return this.catalogService.listWholesale(query);
  }

  @Get('wholesale/:slug')
  @UseGuards(WholesaleAccessGuard)
  wholesaleBySlug(@Param('slug') slug: string) {
    return this.catalogService.findWholesaleBySlug(slug);
  }

  @Get(':slug')
  @Cacheable({ ttlMs: 60_000, tag: CACHE_TAGS.catalog, maxAge: 60 })
  bySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }
}
