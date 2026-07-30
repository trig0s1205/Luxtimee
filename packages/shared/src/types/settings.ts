export interface HomepageHeroConfig {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImageUrl?: string;
}

export interface HomepageFeaturedConfig {
  enabled: boolean;
  label: string;
  titleLead: string;
  titleEm: string;
  intro: string;
  ctaText: string;
  ctaLink: string;
}

export interface HomepageValueProp {
  icon: string;
  title: string;
  description: string;
}

export interface HomepageFounderConfig {
  enabled: boolean;
  badge: string;
  title: string;
  titleEm: string;
  quote: string;
  storyParagraphs: string[];
  signatureName: string;
  signatureRole: string;
  /** Foto circular de la firma (opcional). */
  signatureImageUrl?: string;
  /** Exactamente 5 URLs. Índice 0 = imagen principal (inicia centrada). */
  carouselImages: string[];
}

export interface HomepageValuePropsConfig {
  enabled: boolean;
  label: string;
  title: string;
  items: HomepageValueProp[];
}

export interface HomepageStatementConfig {
  enabled: boolean;
  text: string;
  textEm: string;
  sub: string;
}

export interface HomepageContactConfig {
  enabled: boolean;
  label: string;
  title: string;
  titleEm: string;
  body: string;
  ctaText: string;
  whatsappMessage: string;
}

export interface HomepageConfigDto {
  hero: HomepageHeroConfig;
  featured: HomepageFeaturedConfig;
  founder: HomepageFounderConfig;
  valueProps: HomepageValuePropsConfig;
  statement: HomepageStatementConfig;
  contact: HomepageContactConfig;
}

export interface ShippingZoneDto {
  id: string;
  name: string;
  cost: number;
  isNational: boolean;
}

export interface CreateShippingZoneDto {
  name: string;
  cost: number;
  isNational?: boolean;
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
  reinvestmentPercent: number;
  ownerProfitPercent: number;
}

export interface CommissionConfigDto {
  percent: number;
}

export interface CommissionUpdateResultDto extends CommissionConfigDto {
  updatedWatches: number;
}

export interface PlatformConfigDto {
  supportEmail: string;
  city: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
}
