import { Controller, Get, Logger, Param, Query, UseInterceptors } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { Public } from '../common/decorators/metadata.decorators';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';

@Controller({ path: 'catalog', version: '1' })
@Public()
@UseInterceptors(FinancialStripInterceptor)
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private catalogService: CatalogService) {}

  @Get()
  list(@Query() query: CatalogQueryDto) {
    this.logger.log(`[catalog:list] params=${JSON.stringify(query)}`);
    return this.catalogService.list(query);
  }  @Get('best-sellers')
  bestSellers() {
    return this.catalogService.findBestSellers();
  }

  @Get('featured')
  featured() {
    return this.catalogService.findFeatured();
  }

  @Get('new-arrivals')
  newArrivals() {
    return this.catalogService.findNewArrivals();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }
}
