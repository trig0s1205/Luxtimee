import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CommissionConfigDto,
  CommissionUpdateResultDto,
  LegalDocumentsDto,
  ProfitConfigDto,
  WhatsappSettingDto,
} from '@luxtime/shared';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  }

  async setJson(key: string, value: unknown) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
  }

  getWhatsappLink() {
    return this.getJson<WhatsappSettingDto>('whatsapp_link', {
      url: 'https://wa.me/573000000000',
      messagePrefix: 'Hola Luxtime, deseo comprar:',
    });
  }

  setWhatsappLink(value: WhatsappSettingDto) {
    return this.setJson('whatsapp_link', value);
  }

  getLegalDocuments() {
    return this.getJson<LegalDocumentsDto>('legal_documents', {
      termsPublished: false,
      privacyPublished: false,
      termsDraft: '',
      privacyDraft: '',
    });
  }

  getProfitConfig() {
    return this.getJson<ProfitConfigDto>('profit_config', { defaultProfitPercent: 30 });
  }

  setProfitConfig(value: ProfitConfigDto) {
    return this.setJson('profit_config', value);
  }

  getCommissionConfig() {
    return this.getJson<CommissionConfigDto>('commission_percent', { percent: 5 });
  }

  async setCommissionConfig(value: CommissionConfigDto): Promise<CommissionUpdateResultDto> {
    if (!Number.isFinite(value.percent) || value.percent < 0 || value.percent > 100) {
      throw new BadRequestException('El porcentaje de comisión debe estar entre 0 y 100.');
    }

    await this.setJson('commission_percent', value);

    const updated = await this.prisma.watch.updateMany({
      where: { deletedAt: null },
      data: { secretaryCommissionPercentage: value.percent },
    });

    return {
      percent: value.percent,
      updatedWatches: updated.count,
    };
  }
}
