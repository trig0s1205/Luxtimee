import { HOMEPAGE_HERO_MAX_SLIDES } from '../types/settings.js';

export interface HomepageHeroSlide {
  desktop: string;
  mobile: string;
}

export function emptyHeroSlide(): HomepageHeroSlide {
  return { desktop: '', mobile: '' };
}

export type LegacyHeroSource = {
  enabled?: boolean;
  rotationIntervalSec?: number;
  slides?: unknown;
  backgroundImageUrl?: string;
};

function isHeroSlideObject(value: unknown): value is HomepageHeroSlide {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSlideItem(item: unknown): HomepageHeroSlide {
  if (typeof item === 'string') {
    const url = item.trim();
    return url ? { desktop: url, mobile: '' } : emptyHeroSlide();
  }
  if (isHeroSlideObject(item)) {
    const row = item as Record<string, unknown>;
    const desktop = String(row.desktop ?? row.desktopUrl ?? row.url ?? '').trim();
    const mobile = String(row.mobile ?? row.mobileUrl ?? '').trim();
    return desktop || mobile ? { desktop, mobile } : emptyHeroSlide();
  }
  return emptyHeroSlide();
}

function coerceSlidesArray(rawSlides: unknown): unknown[] {
  if (Array.isArray(rawSlides)) return rawSlides;
  if (rawSlides && typeof rawSlides === 'object') {
    return Object.entries(rawSlides as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, value]) => value);
  }
  return [];
}

export function normalizeHeroSlides(raw?: LegacyHeroSource | null): HomepageHeroSlide[] {
  const empty = (): HomepageHeroSlide[] =>
    Array.from({ length: HOMEPAGE_HERO_MAX_SLIDES }, () => emptyHeroSlide());

  if (!raw) return empty();

  const rawSlides = coerceSlidesArray(raw.slides);
  if (rawSlides.length > 0) {
    return Array.from({ length: HOMEPAGE_HERO_MAX_SLIDES }, (_, i) =>
      normalizeSlideItem(rawSlides[i]),
    );
  }

  const legacy = raw.backgroundImageUrl?.trim() ?? '';
  if (legacy) {
    const slides = empty();
    slides[0] = { desktop: legacy, mobile: '' };
    return slides;
  }

  return empty();
}

export function getActiveHeroSlides(hero: { slides?: unknown }): HomepageHeroSlide[] {
  return normalizeHeroSlides(hero).filter(
    (slide) => Boolean(slide.desktop?.trim() || slide.mobile?.trim()),
  );
}

export function countHeroSlidesWithDesktop(slides: HomepageHeroSlide[]): number {
  return slides.filter((slide) => Boolean(slide.desktop?.trim())).length;
}
