import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../common/decorators/metadata.decorators';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';

@Controller({ path: 'catalog', version: '1' })
@Public()
@UseInterceptors(FinancialStripInterceptor)
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.catalogService.list(query);
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
