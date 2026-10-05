<script setup lang="ts">
import type { HomepageHeroConfig } from '@luxtime/shared';
import { optimizeCloudinaryHeroBannerUrl } from '~/utils/media-url';

const props = defineProps<{
  config: HomepageHeroConfig;
  slides: string[];
}>();

const { resolve } = useMediaUrl();

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const intervalMs = computed(() => {
  const sec = props.config.rotationIntervalSec ?? 8;
  return Math.min(60, Math.max(3, sec)) * 1000;
});

const resolvedSlides = computed(() =>
  props.slides
    .map((url) => optimizeCloudinaryHeroBannerUrl(resolve(url)) ?? resolve(url))
    .filter(Boolean),
);

function goTo(index: number) {
  const len = resolvedSlides.value.length;
  if (!len) return;
  activeIndex.value = ((index % len) + len) % len;
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
  startRotation();
});

watch(intervalMs, () => startRotation());

onMounted(() => startRotation());
onBeforeUnmount(() => stopRotation());
</script>

<template>
  <section
    v-if="resolvedSlides.length"
    class="home-promo-hero home-promo-hero--enter"
    aria-label="Promoción principal"
  >
    <NuxtLink to="/catalogo" class="home-promo-hero__link">
      <div class="home-promo-hero__stage">
        <Transition name="home-promo-fade" mode="out-in">
          <img
            v-if="resolvedSlides[activeIndex]"
            :key="resolvedSlides[activeIndex]"
            :src="resolvedSlides[activeIndex]"
            alt=""
            class="home-promo-hero__img"
            sizes="100vw"
            :fetchpriority="activeIndex === 0 ? 'high' : 'auto'"
            :loading="activeIndex === 0 ? 'eager' : 'lazy'"
            decoding="async"
            draggable="false"
          >
        </Transition>
      </div>
      <span class="home-promo-hero__cta-hint">Ver catálogo</span>
    </NuxtLink>

    <div
      v-if="resolvedSlides.length > 1"
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
        @click.stop.prevent="goTo(i)"
      />
    </div>
  </section>
</template>

<style scoped>
.home-promo-hero {
  position: relative;
  display: block;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 !important;
  background: #0a0a0a;
  border: none;
}

.home-promo-hero__link {
  display: block;
  position: relative;
  line-height: 0;
  text-decoration: none;
  color: inherit;
  outline: none;
}

.home-promo-hero--enter {
  animation: homePromoEnter 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.home-promo-hero__stage {
  position: relative;
  width: 100%;
  line-height: 0;
  border: none;
  border-radius: 0;
  background: #0a0a0a;
}

.home-promo-hero__img {
  display: block;
  width: 100%;
  height: auto;
  vertical-align: top;
}

@keyframes homePromoEnter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-promo-hero--enter {
    animation: none;
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
}

.home-promo-hero__link:hover .home-promo-hero__cta-hint,
.home-promo-hero__link:focus-visible .home-promo-hero__cta-hint {
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
  z-index: 2;
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

.home-promo-fade-enter-active,
.home-promo-fade-leave-active {
  transition: opacity 0.7s ease;
}

.home-promo-fade-enter-from,
.home-promo-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .home-promo-hero__cta-hint {
    opacity: 1;
    transform: none;
    font-size: 8px;
    padding: 7px 12px;
  }
}
</style>
