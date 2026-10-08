<script setup lang="ts">
import type { HomepageHeroConfig } from '@luxtime/shared';
import { getActiveHeroSlides } from '@luxtime/shared';
import {
  optimizeCloudinaryHeroBannerSrcSet,
  optimizeCloudinaryHeroBannerUrl,
} from '~/utils/media-url';

const props = defineProps<{
  config: HomepageHeroConfig;
}>();

const normalizedSlides = computed(() => getActiveHeroSlides(props.config));

const { resolve } = useMediaUrl();

const activeIndex = ref(0);
const stageRef = ref<HTMLElement | null>(null);
const slideWidthPx = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
let resizeObserver: ResizeObserver | null = null;

const intervalMs = computed(() => {
  const sec = props.config.rotationIntervalSec ?? 8;
  return Math.min(60, Math.max(3, sec)) * 1000;
});

const bannerWidth = ref(2560);
const mobileBannerWidth = 1400;

type ResolvedHeroSlide = {
  key: string;
  desktopSrc: string;
  desktopSrcSet?: string;
  mobileSrc?: string;
  mobileSrcSet?: string;
};

const resolvedSlides = computed((): ResolvedHeroSlide[] =>
  normalizedSlides.value
    .map((slide) => {
      const desktopRaw = slide.desktop?.trim();
      const mobileRaw = slide.mobile?.trim();
      const desktopBase = desktopRaw ? resolve(desktopRaw) : undefined;
      const mobileBase = mobileRaw ? resolve(mobileRaw) : undefined;
      const fallback = desktopBase ?? mobileBase;
      if (!fallback) return null;

      const desktopUrl = desktopBase ?? mobileBase!;
      const mobileUrl = mobileBase && mobileRaw !== desktopRaw ? mobileBase : undefined;

      const desktopSrc = optimizeCloudinaryHeroBannerUrl(desktopUrl, bannerWidth.value) ?? desktopUrl;
      const desktopSrcSet = optimizeCloudinaryHeroBannerSrcSet(desktopUrl);
      const mobileSrc = mobileUrl
        ? optimizeCloudinaryHeroBannerUrl(mobileUrl, mobileBannerWidth) ?? mobileUrl
        : undefined;
      const mobileSrcSet = mobileUrl
        ? optimizeCloudinaryHeroBannerSrcSet(mobileUrl, [640, 960, 1200, 1400])
        : undefined;

      return {
        key: `${desktopSrc}|${mobileSrc ?? ''}`,
        desktopSrc,
        desktopSrcSet,
        mobileSrc,
        mobileSrcSet,
      };
    })
    .filter((item): item is ResolvedHeroSlide => item !== null),
);

const hasMultiple = computed(() => resolvedSlides.value.length > 1);

const trackStyle = computed(() => ({
  transform: `translate3d(-${activeIndex.value * slideWidthPx.value}px, 0, 0)`,
}));

function measureStage() {
  if (!stageRef.value) return;
  slideWidthPx.value = stageRef.value.clientWidth;
}

function goTo(index: number) {
  const len = resolvedSlides.value.length;
  if (!len) return;
  activeIndex.value = ((index % len) + len) % len;
}

function goNext() {
  goTo(activeIndex.value + 1);
  restartRotation();
}

function goPrev() {
  goTo(activeIndex.value - 1);
  restartRotation();
}

function restartRotation() {
  stopRotation();
  startRotation();
}

function startRotation() {
  stopRotation();
  if (!import.meta.client || resolvedSlides.value.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => {
    goTo(activeIndex.value + 1);
  }, intervalMs.value);
}

function stopRotation() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(resolvedSlides, () => {
  activeIndex.value = 0;
  nextTick(() => measureStage());
  startRotation();
});

watch(intervalMs, () => startRotation());

onMounted(() => {
  if (import.meta.client) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bannerWidth.value = Math.min(4000, Math.max(1920, Math.round(window.innerWidth * dpr)));
    nextTick(() => {
      measureStage();
      if (stageRef.value && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => measureStage());
        resizeObserver.observe(stageRef.value);
      }
    });
  }
  startRotation();
});

onBeforeUnmount(() => {
  stopRotation();
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <section
    v-if="resolvedSlides.length"
    class="home-promo-hero home-promo-hero--enter"
    aria-label="Promoción principal"
  >
    <div class="home-promo-hero__viewport">
      <div ref="stageRef" class="home-promo-hero__stage">
        <div
          class="home-promo-hero__track"
          :style="trackStyle"
        >
          <div
            v-for="(slide, i) in resolvedSlides"
            :key="slide.key"
            class="home-promo-hero__slide"
            :style="slideWidthPx ? { width: `${slideWidthPx}px` } : undefined"
            :aria-hidden="i !== activeIndex"
          >
            <NuxtLink
              to="/catalogo"
              class="home-promo-hero__slide-link"
              :tabindex="i === activeIndex ? 0 : -1"
            >
              <picture>
                <source
                  v-if="slide.mobileSrc"
                  media="(max-width: 768px)"
                  :srcset="slide.mobileSrcSet || slide.mobileSrc"
                  sizes="100vw"
                >
                <img
                  :src="slide.desktopSrc"
                  :srcset="slide.desktopSrcSet"
                  alt=""
                  class="home-promo-hero__img"
                  sizes="100vw"
                  :fetchpriority="i === 0 ? 'high' : 'auto'"
                  :loading="i === 0 ? 'eager' : 'lazy'"
                  decoding="async"
                  draggable="false"
                >
              </picture>
              <span class="home-promo-hero__cta-hint">Ver catálogo</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <div
        v-if="hasMultiple"
        class="home-promo-hero__controls"
        aria-hidden="false"
      >
        <button
          type="button"
          class="home-promo-hero__nav home-promo-hero__nav--prev"
          aria-label="Imagen anterior"
          @click.stop.prevent="goPrev"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          class="home-promo-hero__nav home-promo-hero__nav--next"
          aria-label="Imagen siguiente"
          @click.stop.prevent="goNext"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>

    <div
      v-if="hasMultiple"
      class="home-promo-hero__dots"
      role="tablist"
      aria-label="Slides del banner"
    >
      <button
        v-for="(_, i) in resolvedSlides"
        :key="`dot-${i}`"
        type="button"
        class="home-promo-hero__dot"
        :class="{ 'home-promo-hero__dot--active': i === activeIndex }"
        :aria-label="`Slide ${i + 1}`"
        :aria-selected="i === activeIndex"
        role="tab"
        @click.stop.prevent="goTo(i); restartRotation()"
      />
    </div>
  </section>
</template>

<style scoped>
.home-promo-hero {
  position: relative;
  display: block;
  padding: 0 !important;
  margin: 0;
  background: #0a0a0a;
  border: none;
}

.home-promo-hero__viewport {
  position: relative;
}

.home-promo-hero--enter {
  animation: homePromoEnter 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.home-promo-hero__stage {
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #0a0a0a;
}

.home-promo-hero__track {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  will-change: transform;
  transition: transform 0.72s cubic-bezier(0.22, 1, 0.36, 1);
}

.home-promo-hero__slide {
  flex: 0 0 auto;
  min-width: 0;
}

.home-promo-hero__slide-link {
  display: block;
  position: relative;
  text-decoration: none;
  color: inherit;
  outline: none;
  line-height: 0;
}

.home-promo-hero__slide-link picture {
  display: block;
  width: 100%;
}

.home-promo-hero__img {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  margin: 0;
  padding: 0;
  vertical-align: top;
  user-select: none;
  -webkit-user-drag: none;
}

.home-promo-hero__controls {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.home-promo-hero__nav {
  position: absolute;
  top: 50%;
  pointer-events: auto;
  z-index: 21;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.4);
  border-radius: 50%;
  background: rgba(10, 10, 10, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--gold-light);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
}

.home-promo-hero__nav span {
  display: block;
  margin-top: -2px;
  pointer-events: none;
}

.home-promo-hero__nav--prev {
  left: 12px;
}

.home-promo-hero__nav--next {
  right: 12px;
}

.home-promo-hero__nav:hover {
  background: rgba(10, 10, 10, 0.78);
  border-color: rgba(200, 169, 110, 0.65);
}

.home-promo-hero__nav:active {
  transform: translateY(-50%) scale(0.96);
}

@keyframes homePromoEnter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-promo-hero--enter {
    animation: none;
  }

  .home-promo-hero__track {
    transition: none;
  }
}

.home-promo-hero__cta-hint {
  position: absolute;
  right: 16px;
  bottom: 14px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: rgba(10, 10, 10, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: var(--font-body);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold-light);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: none;
  line-height: 1.4;
}

.home-promo-hero__slide-link:hover .home-promo-hero__cta-hint,
.home-promo-hero__slide-link:focus-visible .home-promo-hero__cta-hint {
  opacity: 1;
  transform: translateY(0);
}

.home-promo-hero__dots {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 22;
  pointer-events: auto;
}

.home-promo-hero__dot {
  width: 28px;
  height: 2px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  transition: background 0.25s ease, width 0.25s ease;
}

.home-promo-hero__dot--active {
  width: 40px;
  background: var(--gold);
}

@media (max-width: 768px) {
  .home-promo-hero__cta-hint {
    opacity: 1;
    transform: none;
    font-size: 8px;
    padding: 7px 12px;
  }

  .home-promo-hero__nav {
    width: 38px;
    height: 38px;
    font-size: 24px;
  }

  .home-promo-hero__nav--prev {
    left: 8px;
  }

  .home-promo-hero__nav--next {
    right: 8px;
  }
}
</style>
