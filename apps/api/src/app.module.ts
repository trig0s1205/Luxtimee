import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { WarrantiesModule } from './warranties/warranties.module';
import { WarrantyHistoriesModule } from './warranty-histories/warranty-histories.module';
import { CareModule } from './care/care.module';
import { ProductsModule } from './products/products.module';
import { WatchesModule } from './watches/watches.module';
import { InventoryModule } from './inventory/inventory.module';
import { CatalogModule } from './catalog/catalog.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PreOrdersModule } from './pre-orders/pre-orders.module';
import { OrdersModule } from './orders/orders.module';
import { MarketingModule } from './marketing/marketing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { ShippingModule } from './shipping/shipping.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { ScheduleTasksModule } from './common/schedule/schedule-tasks.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { SegmentationModule } from './segmentation/segmentation.module';
import { WholesaleAccessModule } from './wholesale-access/wholesale-access.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CacheModule } from './common/cache/cache.module';
import { ResponseCacheInterceptor } from './common/cache/response-cache.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: isProd ? 80 : 120,
      },
    ]),
    ScheduleModule.forRoot(),
    CacheModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    BrandsModule,
    CategoriesModule,
    WarrantiesModule,
    CareModule,
    ProductsModule,
    WatchesModule,
    InventoryModule,
    CatalogModule,
    IntegrationsModule,
    PreOrdersModule,
    OrdersModule,
    MarketingModule,
    NotificationsModule,
    SettingsModule,
    ShippingModule,
    DashboardsModule,
    ScheduleTasksModule,
    CertificatesModule,
    ReviewsModule,
    WaitlistModule,
    SegmentationModule,
    WarrantyHistoriesModule,
    WholesaleAccessModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseCacheInterceptor,
    },
    AuditInterceptor,
  ],
})
export class AppModule {}
