<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryHeroWatchUrl } from '~/utils/media-url';

const props = defineProps<{
  watches: WatchPublicDto[];
}>();

const INTERVAL_MS = 6000;
const { t } = useLocale();
const { openProduct } = useProductModal();
const { watchPrimaryImage, watchSecondaryImage } = useMediaUrl();

const activeIndex = ref(0);
const paused = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const list = computed(() => props.watches.slice(0, 6));
const active = computed(() => list.value[activeIndex.value] ?? null);
const prevWatch = computed(() => {
  if (list.value.length < 2) return null;
  const i = (activeIndex.value - 1 + list.value.length) % list.value.length;
  return list.value[i] ?? null;
});
const nextWatch = computed(() => {
  if (list.value.length < 2) return null;
  const i = (activeIndex.value + 1) % list.value.length;
  return list.value[i] ?? null;
});

const HERO_IMAGE_WIDTH = 760;

const primaryUrl = computed(() => (
  active.value ? optimizeCloudinaryHeroWatchUrl(watchPrimaryImage(active.value), HERO_IMAGE_WIDTH) : null
));
const insetUrl = computed(() => (
  active.value ? optimizeCloudinaryHeroWatchUrl(watchSecondaryImage(active.value), HERO_IMAGE_WIDTH) : null
));
const swapped = ref(false);

const mainDisplayUrl = computed(() => (swapped.value ? insetUrl.value : primaryUrl.value));
const insetDisplayUrl = computed(() => (swapped.value ? primaryUrl.value : insetUrl.value));
const canSwapFaces = computed(() => !!(primaryUrl.value && insetUrl.value));
const insetAriaLabel = computed(() => (
  swapped.value ? 'Ver frente del reloj' : 'Ver reverso del reloj'
));

function toggleSwap() {
  if (!canSwapFaces.value) return;
  swapped.value = !swapped.value;
}

const isMobileHero = ref(false);

function syncMobileHero() {
  if (!import.meta.client) return;
  isMobileHero.value = window.matchMedia('(max-width: 768px)').matches;
}

function onWatchAreaClick() {
  if (!isMobileHero.value || !canSwapFaces.value) return;
  toggleSwap();
}

const watchTapHint = computed(() => (
  swapped.value ? t('home.heroTapFront') : t('home.heroTapRear')
));

const stockBadge = computed(() => {
  const watch = active.value;
  if (!watch || watch.stock <= 0) return null;
  if (watch.isLimitedEdition) {
    return {
      tone: 'limited' as const,
      label: watch.limitedEditionNumber?.trim()
        ? `${t('product.limited')} · ${watch.limitedEditionNumber.trim()}`
        : t('product.limited'),
    };
  }
  if (watch.stock <= 3) {
    return {
      tone: 'limited' as const,
      label: t('home.heroLimitedTo').replace('{n}', String(watch.stock)),
    };
  }
  return {
    tone: 'ok' as const,
    label: t('product.stockUnits').replace('{n}', String(watch.stock)),
  };
});

const {
  visualEl,
  reducedMotion,
  tiltEnabled,
  tiltStyle,
  shineStyle,
  reflectionStyle,
  onPointerMove,
  onTouchMove,
  onPointerLeave,
} = useHeroSpotlightTilt();

function onHeroEnter() {
  paused.value = true;
}

function onHeroLeave() {
  paused.value = false;
  onPointerLeave();
}

function goTo(index: number) {
  if (!list.value.length) return;
  swapped.value = false;
  activeIndex.value = ((index % list.value.length) + list.value.length) % list.value.length;
  restartTimer();
}

function goPrev() {
  goTo(activeIndex.value - 1);
}

function goNext() {
  goTo(activeIndex.value + 1);
}

function openActive() {
  if (!active.value) return;
  openProduct(active.value.slug);
}

function startTimer() {
  stopTimer();
  if (!import.meta.client || list.value.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = setInterval(() => {
    if (paused.value || !list.value.length) return;
    activeIndex.value = (activeIndex.value + 1) % list.value.length;
  }, INTERVAL_MS);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function restartTimer() {
  startTimer();
}

watch(() => props.watches, () => {
  activeIndex.value = 0;
  swapped.value = false;
  restartTimer();
});

watch(() => active.value?.id, (id) => {
  swapped.value = false;
  if (!import.meta.client || !id) return;
  const next = nextWatch.value;
  const prev = prevWatch.value;
  for (const watch of [next, prev]) {
    if (!watch) continue;
    const href = optimizeCloudinaryHeroWatchUrl(watchPrimaryImage(watch), HERO_IMAGE_WIDTH);
    if (!href) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
  }
});

useHead(() => {
  const href = primaryUrl.value;
  if (!href) return {};
  return {
    link: [{ rel: 'preload', as: 'image', href, fetchpriority: 'high' }],
  };
});

const HERO_EXPAND_SCROLL = 56;
const heroExpanded = ref(false);
const heroRevealEnabled = ref(false);

function syncHeroRevealMode() {
  if (!import.meta.client) return;
  const desktop = window.matchMedia('(min-width: 769px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heroRevealEnabled.value = desktop && !reduceMotion;
  if (!heroRevealEnabled.value) {
    heroExpanded.value = desktop;
    return;
  }
  updateHeroExpandedFromScroll();
}

function updateHeroExpandedFromScroll() {
  if (!heroRevealEnabled.value) return;
  heroExpanded.value = window.scrollY > HERO_EXPAND_SCROLL;
}

onMounted(() => {
  startTimer();
  syncMobileHero();
  syncHeroRevealMode();
  window.addEventListener('resize', syncMobileHero, { passive: true });
  window.addEventListener('resize', syncHeroRevealMode, { passive: true });
  window.addEventListener('scroll', updateHeroExpandedFromScroll, { passive: true });
});
onBeforeUnmount(() => {
  stopTimer();
  if (!import.meta.client) return;
  window.removeEventListener('resize', syncMobileHero);
  window.removeEventListener('resize', syncHeroRevealMode);
  window.removeEventListener('scroll', updateHeroExpandedFromScroll);
});
</script>

<template>
  <section
    id="hero"
    class="lux-hero"
    :class="{ 'lux-hero--expanded': heroExpanded }"
    @mouseenter="onHeroEnter"
    @mouseleave="onHeroLeave"
  >
    <div class="lux-hero__veil" aria-hidden="true" />

    <div class="lux-hero__core">
      <div class="lux-hero__brand">
        <p class="lux-hero__eyebrow">{{ t('home.heroEyebrow') }}</p>
        <h1 class="lux-hero__logo">
          LU<span class="lux-hero__logo-accent">X</span>TIMEE
        </h1>
        <p class="lux-hero__tagline">{{ t('home.heroTagline') }}</p>
      </div>

      <div v-if="active" class="lux-hero__stage">
      <div class="lux-hero__copy">
        <Transition name="hero-fade" mode="out-in">
          <div :key="active.id" class="lux-hero__copy-inner">
            <div class="lux-hero__badges">
              <span
                v-if="stockBadge"
                class="lux-hero__badge"
                :class="`lux-hero__badge--${stockBadge.tone}`"
              >
                {{ stockBadge.label }}
              </span>
            </div>
            <p class="lux-hero__ref">{{ active.sku || active.reference || active.slug }}</p>
            <h2 class="lux-hero__title">
              {{ active.brand.name }}
              <span>{{ active.model }}</span>
            </h2>
            <p class="lux-hero__meta">{{ active.movementType }}</p>
            <p class="lux-hero__price">{{ formatCop(active.retailPrice) }}</p>
            <button type="button" class="lux-hero__cta" @click="openActive">
              {{ t('home.heroFindOutMore') }}
            </button>
          </div>
        </Transition>
      </div>

      <div
        ref="visualEl"
        class="lux-hero__visual"
        @mousemove="onPointerMove"
        @mouseleave="onPointerLeave"
        @touchmove.passive="onTouchMove"
      >
        <Transition name="hero-rise" mode="out-in">
          <div :key="active.id" class="lux-hero__watch-scene">
            <div class="lux-hero__watch-stage" :style="tiltStyle">
              <button
                type="button"
                class="lux-hero__watch-wrap"
                :class="{ 'lux-hero__watch-wrap--swap': canSwapFaces && isMobileHero }"
                :disabled="!canSwapFaces || !isMobileHero"
                :aria-label="canSwapFaces && isMobileHero ? insetAriaLabel : undefined"
                @click="onWatchAreaClick"
              >
                <span v-if="active.stock > 0" class="lux-hero__stock-pill">
                  {{ t('product.stockUnits').replace('{n}', String(active.stock)) }}
                </span>
                <div class="lux-hero__watch-shine" :style="shineStyle" />
                <Transition name="hero-swap" mode="out-in">
                  <img
                    v-if="mainDisplayUrl"
                    :key="`${active.id}-${swapped ? 'rear' : 'front'}`"
                    :src="mainDisplayUrl"
                    :alt="`${active.brand.name} ${active.model}`"
                    class="lux-hero__watch"
                    draggable="false"
                    fetchpriority="high"
                    decoding="async"
                    :loading="activeIndex === 0 ? 'eager' : 'lazy'"
                  >
                  <div v-else class="lux-hero__watch-placeholder" />
                </Transition>
              </button>
              <p
                v-if="canSwapFaces && isMobileHero"
                class="lux-hero__tap-hint"
              >
                {{ watchTapHint }}
              </p>
            </div>
            <div
              v-if="mainDisplayUrl && tiltEnabled"
              class="lux-hero__watch-reflection"
              :style="reflectionStyle"
              aria-hidden="true"
            >
              <img
                :src="mainDisplayUrl"
                alt=""
                draggable="false"
                loading="lazy"
                decoding="async"
              >
            </div>
          </div>
        </Transition>

        <button
          v-if="canSwapFaces && !isMobileHero"
          type="button"
          class="lux-hero__inset"
          :aria-label="insetAriaLabel"
          @click="toggleSwap"
        >
          <Transition name="hero-swap-inset" mode="out-in">
            <img
              v-if="insetDisplayUrl"
              :key="`${active.id}-${swapped ? 'front' : 'rear'}`"
              :src="insetDisplayUrl"
              alt=""
              loading="lazy"
              draggable="false"
            >
          </Transition>
        </button>
      </div>
    </div>
    </div>

    <nav v-if="list.length > 1" class="lux-hero__nav" aria-label="Relojes destacados">
      <button type="button" class="lux-hero__nav-side lux-hero__nav-side--prev" @click="goPrev">
        <span class="lux-hero__nav-arrow">‹</span>
        <span class="lux-hero__nav-label">{{ prevWatch?.model }}</span>
      </button>

      <div class="lux-hero__dots">
        <button
          v-for="(watch, index) in list"
          :key="watch.id"
          type="button"
          class="lux-hero__dot"
          :class="{ 'lux-hero__dot--active': index === activeIndex }"
          :aria-label="`${watch.brand.name} ${watch.model}`"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="goTo(index)"
        >
          <span class="lux-hero__dot-num">{{ String(index + 1).padStart(2, '0') }}</span>
          <span v-if="watch.stock > 0" class="lux-hero__dot-stock">{{ watch.stock }}</span>
          <span class="lux-hero__dot-line" />
        </button>
      </div>

      <button type="button" class="lux-hero__nav-side lux-hero__nav-side--next" @click="goNext">
        <span class="lux-hero__nav-label">{{ nextWatch?.model }}</span>
        <span class="lux-hero__nav-arrow">›</span>
      </button>
    </nav>

    <div class="lux-hero__footer-cta">
      <NuxtLink to="/catalogo" class="lux-hero__footer-btn lux-hero__footer-btn--primary">
        <span>{{ t('home.viewCollection') }}</span>
        <span class="lux-hero__footer-btn-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <NuxtLink to="/mayoristas" class="lux-hero__footer-btn lux-hero__footer-btn--secondary">
        <span>{{ t('nav.wholesale') }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
section.lux-hero {
  --hero-core-scale: 1;
  --hero-logo-size: clamp(2rem, 4vw, 3.25rem);
  --hero-title-size: clamp(1.35rem, 2.4vw, 2.1rem);
  --hero-price-size: clamp(1.6rem, 2.2vw, 2.15rem);
  --hero-watch-w: clamp(268px, 29vw, 460px);
  --hero-visual-min: clamp(220px, 36vh, 420px);
  --hero-visual-max: min(44vh, 440px);
  --hero-copy-max: 420px;
  --hero-stage-cols: minmax(240px, 0.88fr) minmax(380px, 1.28fr);
  --hero-stage-gap: 1.5rem 1.45rem;
  --hero-section-pad: 6.25rem 3.25rem 2rem;
  --hero-brand-mb: 0.65rem;
  --hero-cta-pad: 0.85rem 1.6rem;
  --hero-footer-h: 48px;
  --hero-footer-pad: 0.85rem 1.65rem;
  --hero-nav-mt: 1.25rem;
  --hero-footer-mt: 1.5rem;
  --hero-watch-img-scale: 0.68;

  position: relative;
  min-height: 100dvh;
  max-height: none;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: var(--hero-section-pad) !important;
  overflow: hidden;
  background: var(--black);
  color: var(--white);
  transition:
    padding 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    min-height 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (min-width: 769px) {
  section.lux-hero:not(.lux-hero--expanded) {
    --hero-core-scale: 0.97;
    --hero-logo-size: clamp(1.85rem, 3.45vw, 2.85rem);
    --hero-title-size: clamp(1.15rem, 1.85vw, 1.75rem);
    --hero-price-size: clamp(1.45rem, 1.95vw, 1.95rem);
    --hero-watch-w: clamp(280px, 31vw, 480px);
    --hero-visual-min: clamp(0px, 28vh, 360px);
    --hero-visual-max: min(36vh, 380px);
    --hero-copy-max: 400px;
    --hero-stage-cols: minmax(220px, 1fr) minmax(340px, 1.22fr);
    --hero-stage-gap: 0.65rem 1.35rem;
    --hero-section-pad: 2.65rem 1.15rem 0.55rem;
    --hero-brand-mb: 0;
    --hero-cta-pad: 0.78rem 1.45rem;
    --hero-footer-h: 42px;
    --hero-footer-pad: 0.68rem 1.4rem;
    --hero-nav-mt: 0;
    --hero-footer-mt: 0.35rem;
    --hero-watch-img-scale: 0.78;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    align-content: stretch;
    max-height: 100dvh;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__core {
    grid-row: 1;
    justify-content: flex-start;
    flex: none;
    min-height: 0;
    max-width: 100%;
    width: 100%;
    gap: 0.05rem;
    margin-top: -0.35rem;
    overflow: hidden;
    transform-origin: center top;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__nav {
    grid-row: 2;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__footer-cta {
    grid-row: 3;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__watch-reflection {
    display: none;
  }

  section.lux-hero.lux-hero--expanded {
    display: flex;
    flex-direction: column;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__eyebrow {
    margin-bottom: 0.3rem;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__tagline {
    margin-top: 0.4rem;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__stage {
    width: 100%;
  }

  section.lux-hero:not(.lux-hero--expanded) .lux-hero__nav,
  section.lux-hero:not(.lux-hero--expanded) .lux-hero__footer-cta {
    flex-shrink: 0;
  }

  section.lux-hero--expanded .lux-hero__core {
    transform-origin: center center;
  }

  section.lux-hero--expanded .lux-hero__stage {
    margin-top: 0.15rem;
  }
}

.lux-hero__core {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  gap: 0.35rem;
  transform: scale(var(--hero-core-scale));
  transform-origin: center center;
  transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(10, 10, 10, 0.55) 0%, transparent 28%, transparent 70%, rgba(10, 10, 10, 0.75) 100%),
    radial-gradient(ellipse at 50% 42%, rgba(200, 169, 110, 0.04), transparent 52%);
  z-index: 1;
}

.lux-hero__core,
.lux-hero__nav,
.lux-hero__footer-cta {
  position: relative;
  z-index: 2;
}

.lux-hero__brand {
  text-align: center;
  margin-bottom: var(--hero-brand-mb, 0.15rem);
  flex-shrink: 0;
  transition: margin-bottom 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__eyebrow {
  margin: 0 0 0.55rem;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.lux-hero__logo {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--hero-logo-size);
  font-weight: 500;
  letter-spacing: 0.22em;
  line-height: 1;
  color: var(--white);
  transition: font-size 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__logo-accent {
  color: var(--white);
}

.lux-hero__tagline {
  margin: 0.65rem 0 0;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.lux-hero__stage {
  flex: 1;
  display: grid;
  grid-template-columns: var(--hero-stage-cols);
  gap: var(--hero-stage-gap);
  align-items: center;
  min-height: 0;
  width: 100%;
  transition: gap 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__copy {
  justify-self: end;
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.lux-hero__copy-inner {
  max-width: var(--hero-copy-max);
  width: 100%;
  margin-right: -2%;
  transition: max-width 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (min-width: 769px) {
  section.lux-hero--expanded .lux-hero__copy {
    justify-content: flex-start;
  }

  section.lux-hero--expanded .lux-hero__copy-inner {
    margin-right: 0;
  }

  section.lux-hero--expanded .lux-hero__core {
    max-width: 100%;
  }
}

.lux-hero__badges {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.lux-hero__badge {
  display: inline-flex;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: var(--white-dim);
}

.lux-hero__badge--limited {
  border-color: rgba(200, 169, 110, 0.35);
  color: var(--gold-light);
}

.lux-hero__badge--ok {
  border-color: rgba(255, 255, 255, 0.22);
  color: var(--white);
}

.lux-hero__badge--sold {
  border-color: rgba(255, 85, 85, 0.45);
  color: #ff8888;
}

.lux-hero__ref {
  margin: 0 0 0.55rem;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.lux-hero__title {
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--hero-title-size);
  font-weight: 500;
  letter-spacing: 0.1em;
  line-height: 1.22;
  text-transform: uppercase;
  color: var(--white);
  transition: font-size 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__title span {
  display: block;
  margin-top: 0.2rem;
  font-weight: 400;
  color: var(--white-dim);
}

.lux-hero__meta {
  margin: 0.85rem 0 0;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.lux-hero__price {
  margin: 0.75rem 0 0;
  font-family: var(--font-display);
  font-size: var(--hero-price-size);
  font-weight: 300;
  color: var(--white);
  transition: font-size 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__cta {
  margin-top: 1rem;
  padding: var(--hero-cta-pad);
  transition: padding 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  border: none;
  border-radius: 999px;
  background: var(--gold);
  color: var(--black);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.35s ease, box-shadow 0.35s ease, filter 0.35s ease;
  box-shadow: 0 10px 30px rgba(255, 255, 255, 0.1);
}

.lux-hero__cta:hover {
  transform: translateY(-2px);
  filter: brightness(0.96);
  box-shadow: 0 14px 36px rgba(255, 255, 255, 0.16);
}

.lux-hero__visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--hero-visual-min);
  max-height: var(--hero-visual-max);
  overflow: visible;
  transition: min-height 0.85s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__watch-scene {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lux-hero__watch-stage {
  position: relative;
  transform-style: preserve-3d;
  transition: filter 0.35s ease;
}

.lux-hero__watch-wrap {
  position: relative;
  width: min(100%, var(--hero-watch-w));
  transition: width 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
  border: none;
  padding: 0;
  background: transparent;
  margin: 0 auto;
}

.lux-hero__watch-wrap:disabled {
  cursor: default;
}

.lux-hero__watch-wrap--swap {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.lux-hero__watch-wrap--swap:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 6px;
  border-radius: 12px;
}

.lux-hero__tap-hint {
  margin: 0.35rem 0 0;
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-align: center;
  color: var(--gold-light);
  opacity: 0.9;
}

.lux-hero__watch-shine {
  position: absolute;
  inset: 4% 8%;
  border-radius: 42% 42% 48% 48%;
  pointer-events: none;
  z-index: 2;
  mix-blend-mode: soft-light;
  transition: opacity 0.35s ease;
}

.lux-hero__watch-reflection {
  width: min(100%, clamp(220px, 24vw, 380px));
  height: clamp(36px, 6vh, 64px);
  margin-top: -0.5rem;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent);
  pointer-events: none;
  transition: opacity 0.35s ease, transform 0.2s ease;
}

.lux-hero__watch-reflection img {
  width: 100%;
  height: auto;
  transform: scaleY(-1);
  opacity: 0.55;
  filter: blur(1px) brightness(0.85);
  object-fit: contain;
}

.lux-hero__stock-pill {
  position: absolute;
  top: 8%;
  right: 6%;
  z-index: 2;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-light);
}

.lux-hero__watch {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(var(--hero-watch-img-scale, 0.68));
  transform-origin: center center;
  transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  user-select: none;
  image-rendering: auto;
  position: relative;
  z-index: 1;
}

.lux-hero__watch-placeholder {
  width: 55%;
  height: 55%;
  border-radius: 50%;
  background: rgba(200, 169, 110, 0.08);
}

.lux-hero__inset {
  position: absolute;
  right: 2%;
  top: 10%;
  width: clamp(72px, 9vw, 112px);
  aspect-ratio: 3 / 4;
  height: auto;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: rgba(17, 17, 17, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  z-index: 2;
  padding: 0;
  cursor: pointer;
  transition: transform 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
}

.lux-hero__inset:hover {
  transform: scale(1.06);
  border-color: rgba(200, 169, 110, 0.65);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), 0 0 0 4px rgba(200, 169, 110, 0.08);
}

.lux-hero__inset:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}

.lux-hero__inset img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transform: scale(0.79);
  transform-origin: center center;
}

.hero-swap-enter-active,
.hero-swap-leave-active {
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-swap-enter-from {
  opacity: 0;
  transform: scale(0.9) rotateY(-14deg);
}

.hero-swap-leave-to {
  opacity: 0;
  transform: scale(1.05) rotateY(14deg);
}

.hero-swap-inset-enter-active,
.hero-swap-inset-leave-active {
  transition:
    opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-swap-inset-enter-from {
  opacity: 0;
  transform: scale(0.75) rotate(-10deg);
}

.hero-swap-inset-leave-to {
  opacity: 0;
  transform: scale(1.15) rotate(10deg);
}

.lux-hero__nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  margin-top: var(--hero-nav-mt);
  flex-shrink: 0;
  transition: margin-top 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 1100px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.lux-hero__nav-side {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: transparent;
  border: none;
  color: var(--white-dim);
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.3s ease;
  min-width: 0;
}

.lux-hero__nav-side:hover {
  color: var(--gold);
}

.lux-hero__nav-side--prev {
  justify-content: flex-start;
}

.lux-hero__nav-side--next {
  justify-content: flex-end;
}

.lux-hero__nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.lux-hero__nav-arrow {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--gold);
}

.lux-hero__dots {
  display: flex;
  align-items: flex-end;
  gap: 0.85rem;
}

.lux-hero__dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--white-dim);
}

.lux-hero__dot-num {
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.14em;
  transition: color 0.3s ease;
}

.lux-hero__dot-stock {
  font-family: var(--font-body);
  font-size: 8px;
  letter-spacing: 0.08em;
  color: var(--gold);
  line-height: 1;
}

.lux-hero__dot-line {
  width: 28px;
  height: 1px;
  background: rgba(245, 240, 232, 0.2);
  transition: width 0.4s ease, background 0.4s ease;
}

.lux-hero__dot--active .lux-hero__dot-num {
  color: var(--gold);
}

.lux-hero__dot--active .lux-hero__dot-line {
  width: 42px;
  background: var(--gold);
}

.lux-hero__footer-cta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: var(--hero-footer-mt);
  flex-shrink: 0;
  transition: margin-top 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-hero__footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  min-height: var(--hero-footer-h);
  padding: var(--hero-footer-pad);
  transition: min-height 0.85s cubic-bezier(0.22, 1, 0.36, 1), padding 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-decoration: none;
  transition:
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.35s ease,
    border-color 0.35s ease,
    background 0.35s ease;
}

.lux-hero__footer-btn--primary {
  color: var(--black);
  background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 55%, var(--gold-dark) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 10px 32px rgba(200, 169, 110, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.lux-hero__footer-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 16px 40px rgba(200, 169, 110, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.lux-hero__footer-btn--secondary {
  color: var(--gold-light);
  background: rgba(10, 10, 10, 0.55);
  border: 1px solid rgba(200, 169, 110, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.lux-hero__footer-btn--secondary:hover {
  color: var(--white);
  border-color: var(--gold);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
}

.lux-hero__footer-btn-arrow {
  font-size: 1.1rem;
  line-height: 1;
  transition: transform 0.35s ease;
}

.lux-hero__footer-btn--primary:hover .lux-hero__footer-btn-arrow {
  transform: translateX(4px);
}

.hero-rise-enter-active {
  transition:
    opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-rise-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.32s ease;
}

.hero-rise-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.hero-rise-leave-to {
  opacity: 0;
  transform: translateY(-24px) scale(0.95);
}

.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 1024px) {
  section.lux-hero {
    max-height: none;
    padding: 6rem 2rem 1.75rem !important;
  }

  .lux-hero__stage {
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .lux-hero__nav-label {
    max-width: 110px;
  }
}

@media (max-width: 768px) {
  section.lux-hero {
    min-height: auto;
    max-height: none;
    padding: 5.5rem 1.25rem 2rem !important;
  }

  .lux-hero__core {
    flex: none;
    justify-content: flex-start;
    transform: none;
  }

  .lux-hero__stage {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 1.5rem;
  }

  .lux-hero__copy {
    justify-content: center;
    order: 1;
  }

  .lux-hero__copy-inner {
    max-width: none;
    margin: 0 auto;
  }

  .lux-hero__badges {
    justify-content: center;
  }

  .lux-hero__title span {
    display: inline;
    margin-left: 0.35rem;
  }

  .lux-hero__visual {
    min-height: 240px;
    order: 0;
    justify-content: center;
  }

  .lux-hero__watch-scene {
    width: 100%;
    align-items: center;
  }

  .lux-hero__watch-stage {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .lux-hero__watch-wrap {
    width: min(88vw, 300px);
  }

  .lux-hero__watch {
    transform: scale(0.88);
  }

  .lux-hero__inset {
    display: none;
  }

  .lux-hero__nav {
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
  }

  .lux-hero__nav-label {
    display: none;
  }

  .lux-hero__dots {
    justify-content: center;
    gap: 0.55rem;
  }

  .lux-hero__dot-line {
    width: 18px;
  }

  .lux-hero__dot--active .lux-hero__dot-line {
    width: 28px;
  }

  .lux-hero__footer-cta {
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .lux-hero__footer-btn {
    width: 100%;
    max-width: 320px;
  }
}

@media (max-width: 480px) {
  section.lux-hero {
    padding: 5rem 1rem 1.75rem !important;
  }

  .lux-hero__visual {
    min-height: 220px;
  }

  .lux-hero__watch-wrap {
    width: min(92vw, 280px);
  }
}

@media (prefers-reduced-motion: reduce) {
  section.lux-hero,
  .lux-hero__core,
  .lux-hero__logo,
  .lux-hero__title,
  .lux-hero__price,
  .lux-hero__cta,
  .lux-hero__visual,
  .lux-hero__watch-wrap,
  .lux-hero__nav,
  .lux-hero__footer-cta,
  .lux-hero__footer-btn,
  .lux-hero__copy-inner,
  .lux-hero__stage {
    transition: none !important;
  }

  .lux-hero__core {
    transform: none !important;
  }

  .hero-rise-enter-active,
  .hero-rise-leave-active,
  .hero-fade-enter-active,
  .hero-fade-leave-active,
  .hero-swap-enter-active,
  .hero-swap-leave-active,
  .hero-swap-inset-enter-active,
  .hero-swap-inset-leave-active,
  .lux-hero__inset,
  .lux-hero__watch-stage {
    transition: none;
  }

  .lux-hero__watch-reflection,
  .lux-hero__watch-shine {
    display: none;
  }

  .lux-hero__watch {
    filter: drop-shadow(0 36px 60px rgba(0, 0, 0, 0.62));
  }
}
</style>
