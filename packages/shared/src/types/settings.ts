export interface ShippingZoneDto {
  id: string;
  name: string;
  cost: number;
  isNational: boolean;
}

export interface WhatsappSettingDto {
  url: string;
  messagePrefix: string;
}

export interface LegalDocumentsDto {
  termsPublished: boolean;
  privacyPublished: boolean;
  termsDraft: string;
  privacyDraft: string;
}

export interface ProfitConfigDto {
  defaultProfitPercent: number;
}

export interface CommissionConfigDto {
  percent: number;
}

export interface CommissionUpdateResultDto extends CommissionConfigDto {
  updatedWatches: number;
}
