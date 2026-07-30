<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

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

const primaryUrl = computed(() => (active.value ? watchPrimaryImage(active.value) : null));
const insetUrl = computed(() => (active.value ? watchSecondaryImage(active.value) : null));

const stockBadge = computed(() => {
  const watch = active.value;
  if (!watch) return null;
  if (watch.stock <= 0) return { tone: 'sold' as const, label: t('home.heroSoldOut') };
  if (watch.stock <= 3) {
    return {
      tone: 'limited' as const,
      label: t('home.heroLimitedTo').replace('{n}', String(watch.stock)),
    };
  }
  return { tone: 'ok' as const, label: t('home.heroAvailable') };
});

const glowTone = computed(() => activeIndex.value % 3);

function goTo(index: number) {
  if (!list.value.length) return;
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
  restartTimer();
});

onMounted(() => startTimer());
onBeforeUnmount(() => stopTimer());
</script>

<template>
  <section
    id="hero"
    class="lux-hero"
    :class="`lux-hero--tone-${glowTone}`"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="lux-hero__glow" aria-hidden="true" />
    <div class="lux-hero__veil" aria-hidden="true" />

    <div class="lux-hero__brand">
      <p class="lux-hero__eyebrow">{{ t('home.heroEyebrow') }}</p>
      <h1 class="lux-hero__logo">
        LU<span class="lux-hero__logo-gold">X</span>TIME
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

      <div class="lux-hero__visual">
        <Transition name="hero-fade" mode="out-in">
          <div :key="active.id" class="lux-hero__watch-wrap">
            <img
              v-if="primaryUrl"
              :src="primaryUrl"
              :alt="`${active.brand.name} ${active.model}`"
              class="lux-hero__watch"
              draggable="false"
            >
            <div v-else class="lux-hero__watch-placeholder" />
          </div>
        </Transition>

        <div v-if="insetUrl" class="lux-hero__inset" aria-hidden="true">
          <img :src="insetUrl" alt="" loading="lazy">
        </div>
      </div>
    </div>

    <nav v-if="list.length > 1" class="lux-hero__nav" aria-label="Más vendidos">
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
          <span class="lux-hero__dot-line" />
        </button>
      </div>

      <button type="button" class="lux-hero__nav-side lux-hero__nav-side--next" @click="goNext">
        <span class="lux-hero__nav-label">{{ nextWatch?.model }}</span>
        <span class="lux-hero__nav-arrow">›</span>
      </button>
    </nav>

    <div class="lux-hero__footer-cta">
      <NuxtLink to="/catalogo" class="btn-ghost">{{ t('home.viewCollection') }}</NuxtLink>
      <NuxtLink to="/mayoristas" class="btn-ghost">{{ t('nav.wholesale') }}</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.lux-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 7.5rem 3.5rem 2.5rem;
  overflow: hidden;
  background: var(--black);
  color: var(--white);
}

.lux-hero__glow {
  position: absolute;
  inset: 12% 18% 18% 22%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(200, 169, 110, 0.28) 0%, rgba(200, 169, 110, 0.08) 38%, transparent 70%);
  filter: blur(8px);
  transition: opacity 1.1s ease, transform 1.4s ease, background 1.4s ease;
  z-index: 0;
}

.lux-hero--tone-0 .lux-hero__glow {
  opacity: 1;
  transform: scale(1) translate(4%, -2%);
  background: radial-gradient(circle at 48% 42%, rgba(226, 201, 138, 0.3) 0%, rgba(200, 169, 110, 0.1) 40%, transparent 72%);
}

.lux-hero--tone-1 .lux-hero__glow {
  opacity: 0.92;
  transform: scale(1.05) translate(-3%, 3%);
  background: radial-gradient(circle at 55% 48%, rgba(154, 122, 69, 0.32) 0%, rgba(200, 169, 110, 0.1) 42%, transparent 70%);
}

.lux-hero--tone-2 .lux-hero__glow {
  opacity: 0.88;
  transform: scale(0.96) translate(2%, 4%);
  background: radial-gradient(circle at 45% 50%, rgba(200, 169, 110, 0.26) 0%, rgba(245, 240, 232, 0.04) 45%, transparent 72%);
}

.lux-hero__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(10, 10, 10, 0.55) 0%, transparent 28%, transparent 70%, rgba(10, 10, 10, 0.75) 100%),
    radial-gradient(ellipse at 80% 20%, rgba(200, 169, 110, 0.05), transparent 45%);
  z-index: 1;
}

.lux-hero__brand,
.lux-hero__stage,
.lux-hero__nav,
.lux-hero__footer-cta {
  position: relative;
  z-index: 2;
}

.lux-hero__brand {
  text-align: center;
  margin-bottom: 1.25rem;
}

.lux-hero__eyebrow {
  margin: 0 0 0.55rem;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--gold);
}

.lux-hero__logo {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.25rem);
  font-weight: 500;
  letter-spacing: 0.22em;
  line-height: 1;
  color: var(--white);
}

.lux-hero__logo-gold {
  color: var(--gold);
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
  grid-template-columns: minmax(240px, 0.88fr) minmax(380px, 1.28fr);
  gap: 1.5rem 1.45rem;
  align-items: center;
  min-height: 0;
  max-width: 1480px;
  width: 100%;
  margin: 0 auto;
}

.lux-hero__copy {
  justify-self: end;
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.lux-hero__copy-inner {
  max-width: 420px;
  width: 100%;
  margin-right: -4%;
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
  border: 1px solid rgba(200, 169, 110, 0.28);
  color: var(--gold-light);
}

.lux-hero__badge--limited {
  border-color: rgba(200, 169, 110, 0.55);
  color: var(--gold);
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
  font-size: clamp(1.35rem, 2.4vw, 2.1rem);
  font-weight: 500;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--white);
}

.lux-hero__title span {
  display: block;
  margin-top: 0.2rem;
  font-weight: 400;
  color: var(--gold-light);
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
  margin: 1.1rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 2.2vw, 2.15rem);
  font-weight: 300;
  color: var(--gold);
}

.lux-hero__cta {
  margin-top: 1.5rem;
  padding: 0.85rem 1.6rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--gold-light), var(--gold-dark));
  color: var(--black);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.35s ease, box-shadow 0.35s ease, filter 0.35s ease;
  box-shadow: 0 10px 30px rgba(200, 169, 110, 0.18);
}

.lux-hero__cta:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
  box-shadow: 0 14px 36px rgba(200, 169, 110, 0.28);
}

.lux-hero__visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(280px, 44vh, 510px);
  overflow: visible;
}

.lux-hero__watch-wrap {
  width: min(100%, clamp(310px, 34vw, 530px));
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lux-hero__watch {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(0.79);
  transform-origin: center center;
  filter: drop-shadow(0 36px 60px rgba(0, 0, 0, 0.62));
  user-select: none;
  image-rendering: auto;
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
  width: clamp(72px, 8vw, 104px);
  height: clamp(72px, 8vw, 104px);
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: rgba(17, 17, 17, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  z-index: 2;
}

.lux-hero__inset img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lux-hero__nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
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
  gap: 0.75rem;
  margin-top: 1.5rem;
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
  .lux-hero {
    padding: 6.5rem 2rem 2rem;
  }

  .lux-hero__stage {
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .lux-hero__nav-label {
    max-width: 110px;
  }
}

/* Móvil: layout compacto, sin romper usabilidad; rediseño mobile en fase aparte */
@media (max-width: 768px) {
  .lux-hero {
    min-height: auto;
    padding: 6rem 1.25rem 2rem;
  }

  .lux-hero__stage {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .lux-hero__copy {
    justify-content: center;
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
    min-height: 220px;
    order: -1;
  }

  .lux-hero__watch-wrap {
    width: min(100%, 235px);
  }

  .lux-hero__watch {
    transform: scale(0.7);
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
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-fade-enter-active,
  .hero-fade-leave-active,
  .lux-hero__glow {
    transition: none;
  }
}
</style>
