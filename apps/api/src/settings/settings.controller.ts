import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { CACHE_TAGS, Cacheable } from '../common/cache/cache.decorator';
import { Public, Roles, Audit, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';
import { assertImageBuffer, MAX_IMAGE_BYTES } from '../common/utils/file-magic.util';
import {
  DeleteFounderImageBodyDto,
  SetCommissionBodyDto,
  SetHomepageConfigBodyDto,
  SetPlatformBodyDto,
  SetProfitBodyDto,
  SetWhatsappBodyDto,
} from './dto/settings-body.dto';

@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Public()
  @Get('legal/public')
  @Cacheable({ ttlMs: 600_000, tag: CACHE_TAGS.settings, maxAge: 300 })
  getLegalPublic() {
    return this.settingsService.getLegalDocuments();
  }

  @Public()
  @Get('whatsapp/public')
  @Cacheable({ ttlMs: 600_000, tag: CACHE_TAGS.settings, maxAge: 300 })
  getWhatsappPublic() {
    return this.settingsService.getWhatsappLink();
  }

  @Public()
  @Get('platform/public')
  @Cacheable({ ttlMs: 600_000, tag: CACHE_TAGS.settings, maxAge: 300 })
  getPlatformPublic() {
    return this.settingsService.getPlatformConfig();
  }

  @Public()
  @Get('homepage/public')
  @Cacheable({ ttlMs: 300_000, tag: CACHE_TAGS.settings, maxAge: 120 })
  getHomepagePublic() {
    return this.settingsService.getHomepageConfig();
  }

  @Get('whatsapp')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  getWhatsapp() {
    return this.settingsService.getWhatsappLink();
  }

  @Patch('whatsapp')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Setting')
  setWhatsapp(@Body() body: SetWhatsappBodyDto) {
    return this.settingsService.setWhatsappLink(body);
  }

  @Get('platform')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  getPlatform() {
    return this.settingsService.getPlatformConfig();
  }

  @Patch('platform')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Setting')
  setPlatform(@Body() body: SetPlatformBodyDto) {
    return this.settingsService.setPlatformConfig(body);
  }

  @Get('profit')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  getProfit() {
    return this.settingsService.getProfitConfig();
  }

  @Patch('profit')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  @Audit('UPDATE', 'Setting')
  setProfit(@Body() body: SetProfitBodyDto) {
    return this.settingsService.setProfitConfig(body);
  }

  @Get('commission')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  getCommission() {
    return this.settingsService.getCommissionConfig();
  }

  @Patch('commission')
  @Roles(Role.SUPER_ADMIN)
  @UseGuards(RolesGuard, FinancialGuard)
  @Financial()
  @Audit('UPDATE', 'Setting')
  setCommission(@Body() body: SetCommissionBodyDto) {
    return this.settingsService.setCommissionConfig(body);
  }

  @Get('homepage')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  getHomepage() {
    return this.settingsService.getHomepageConfig();
  }

  @Patch('homepage')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Setting')
  setHomepage(@Body() body: SetHomepageConfigBodyDto) {
    return this.settingsService.setHomepageConfig(body as never);
  }

  @Post('homepage/upload-founder-images')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async uploadFounderImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    if (!files?.length) throw new BadRequestException('No se recibieron imágenes');
    const urls: string[] = [];
    for (const file of files) {
      assertImageBuffer(file.buffer, file.mimetype);
      const { url } = await this.settingsService.uploadFounderImage(file);
      urls.push(url);
    }
    return { urls };
  }

  @Post('homepage/upload-customer-proof-images')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FilesInterceptor('images', 1, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async uploadCustomerProofImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    if (!files?.length) throw new BadRequestException('No se recibió la imagen');
    const urls: string[] = [];
    for (const file of files) {
      assertImageBuffer(file.buffer, file.mimetype);
      const { url } = await this.settingsService.uploadCustomerProofImage(file);
      urls.push(url);
    }
    return { urls };
  }

  @Delete('homepage/founder-image')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Audit('DELETE', 'Setting')
  async deleteFounderImage(@Query() query: DeleteFounderImageBodyDto) {
    await this.settingsService.deleteFounderImage(query.url);
    return { ok: true };
  }
}
