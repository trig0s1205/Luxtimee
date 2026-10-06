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
    return {
      desktop: String((item as HomepageHeroSlide).desktop ?? '').trim(),
      mobile: String((item as HomepageHeroSlide).mobile ?? '').trim(),
    };
  }
  return emptyHeroSlide();
}

function coerceSlidesArray(rawSlides: unknown): unknown[] {
  if (Array.isArray(rawSlides)) return rawSlides;
  if (rawSlides && typeof rawSlides === 'object') {
    return Object.values(rawSlides as Record<string, unknown>);
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
