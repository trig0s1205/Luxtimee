import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CommissionConfigDto,
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

  setCommissionConfig(value: CommissionConfigDto) {
    return this.setJson('commission_percent', value);
  }
}
