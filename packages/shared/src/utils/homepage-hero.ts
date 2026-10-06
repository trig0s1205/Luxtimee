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
  return Boolean(value && typeof value === 'object' && ('desktop' in value || 'mobile' in value));
}

export function normalizeHeroSlides(raw?: LegacyHeroSource | null): HomepageHeroSlide[] {
  const empty = (): HomepageHeroSlide[] =>
    Array.from({ length: HOMEPAGE_HERO_MAX_SLIDES }, () => emptyHeroSlide());

  if (!raw) return empty();

  const rawSlides = raw.slides;
  if (Array.isArray(rawSlides) && rawSlides.length > 0) {
    if (isHeroSlideObject(rawSlides[0])) {
      return Array.from({ length: HOMEPAGE_HERO_MAX_SLIDES }, (_, i) => {
        const item = rawSlides[i];
        if (!isHeroSlideObject(item)) return emptyHeroSlide();
        return {
          desktop: String(item.desktop ?? '').trim(),
          mobile: String(item.mobile ?? '').trim(),
        };
      });
    }
    if (typeof rawSlides[0] === 'string') {
      return Array.from({ length: HOMEPAGE_HERO_MAX_SLIDES }, (_, i) => {
        const url = String(rawSlides[i] ?? '').trim();
        return url ? { desktop: url, mobile: '' } : emptyHeroSlide();
      });
    }
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
