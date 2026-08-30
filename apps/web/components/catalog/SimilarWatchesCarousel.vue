<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';

const props = withDefaults(defineProps<{
  watches: WatchPublicDto[];
  cycleSeconds?: number;
  eyebrow?: string;
  title?: string;
  compact?: boolean;
}>(), {
  cycleSeconds: 5,
  eyebrow: 'Selección curada',
  title: 'Relojes que combinan con tu gusto',
  compact: false,
});

const RESUME_DELAY = 2200;

const viewport = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);

let frameId: number | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let lastFrame = 0;
let offset = 0;
let paused = false;

const loopedWatches = computed(() => (
  props.watches.length ? [...props.watches, ...props.watches] : []
));

function loopWidth() {
  return track.value ? track.value.scrollWidth / 2 : 0;
}

function normalizeScroll() {
  const el = viewport.value;
  const width = loopWidth();
  if (!el || width <= 0) return;

  if (el.scrollLeft >= width) el.scrollLeft -= width;
  else if (el.scrollLeft < 0) el.scrollLeft += width;
  offset = el.scrollLeft;
}

function scrollSpeed() {
  const width = loopWidth();
  return width > 0 ? width / props.cycleSeconds : 0;
}

function step(timestamp: number) {
  const el = viewport.value;
  if (!el) return;

  const delta = lastFrame ? (timestamp - lastFrame) / 1000 : 0;
  lastFrame = timestamp;

  if (!paused && delta > 0) {
    offset += scrollSpeed() * delta;
    const width = loopWidth();
    if (width > 0 && offset >= width) offset -= width;
    el.scrollLeft = offset;
  }

  frameId = requestAnimationFrame(step);
}

function startAutoScroll() {
  if (frameId !== null || !import.meta.client) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lastFrame = 0;
  frameId = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function pause() {
  paused = true;
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function resume() {
  normalizeScroll();
  paused = false;
}

function pauseTemporarily() {
  pause();
  resumeTimer = setTimeout(resume, RESUME_DELAY);
}

function scrollByCards(direction: -1 | 1) {
  const el = viewport.value;
  if (!el) return;

  pause();
  normalizeScroll();
  el.scrollBy({ left: direction * el.clientWidth * 0.6, behavior: 'smooth' });
  resumeTimer = setTimeout(resume, RESUME_DELAY);
}

function onManualScroll() {
  if (!paused) return;
  offset = viewport.value?.scrollLeft ?? offset;
}

function resetCarousel() {
  const el = viewport.value;
  if (!el) return;
  offset = 0;
  el.scrollLeft = 0;
}

function initCarousel() {
  stopAutoScroll();
  nextTick(() => {
    requestAnimationFrame(() => {
      if (loopWidth() <= 0) return;
      resetCarousel();
      paused = false;
      startAutoScroll();
    });
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  initCarousel();
  if (viewport.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (loopWidth() > 0 && frameId === null) initCarousel();
    });
    resizeObserver.observe(viewport.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopAutoScroll();
});

watch(() => props.watches, () => {
  initCarousel();
});
</script>

<template>
  <section v-if="watches.length" class="similar-watches" :class="{ 'similar-watches--compact': compact }">
    <header class="similar-watches__header">
      <p class="similar-watches__eyebrow">{{ eyebrow }}</p>
      <h2 class="similar-watches__title">{{ title }}</h2>
    </header>

    <div class="similar-watches__carousel">
      <div class="similar-watches__fade similar-watches__fade--left" aria-hidden="true" />
      <div class="similar-watches__fade similar-watches__fade--right" aria-hidden="true" />

      <button
        type="button"
        class="similar-watches__arrow similar-watches__arrow--prev"
        aria-label="Ver relojes anteriores"
        @click="scrollByCards(-1)"
      >
        ‹
      </button>
      <button
        type="button"
        class="similar-watches__arrow similar-watches__arrow--next"
        aria-label="Ver más relojes"
        @click="scrollByCards(1)"
      >
        ›
      </button>

      <div
        ref="viewport"
        class="similar-watches__viewport"
        @mouseenter="pause"
        @mouseleave="resume"
        @pointerdown="pause"
        @pointerup="pauseTemporarily"
        @touchstart.passive="pause"
        @touchend.passive="pauseTemporarily"
        @wheel.passive="pauseTemporarily"
        @scroll.passive="onManualScroll"
      >
        <div ref="track" class="similar-watches__track">
          <div
            v-for="(item, index) in loopedWatches"
            :key="`${item.id}-${index}`"
            class="similar-watches__slide"
            :style="{ '--slide-delay': `${(index % watches.length) * 0.35}s` }"
          >
            <CatalogProductCard :watch="item" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.similar-watches {
  width: 100%;
  max-width: 100%;
  margin: 24px auto 0;
  padding-top: 20px;
  border-top: var(--border-hairline);
}

.similar-watches__header {
  margin-bottom: 18px;
  text-align: center;
}

.similar-watches__eyebrow {
  margin: 0 0 8px;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--gold);
}

.similar-watches__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 300;
  color: var(--white);
}

.similar-watches__carousel {
  position: relative;
  width: 100%;
  margin: 0 auto;
}

.similar-watches__viewport {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 0 18px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
}

.similar-watches__viewport::-webkit-scrollbar {
  display: none;
}

.similar-watches__fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14%;
  z-index: 2;
  pointer-events: none;
}

.similar-watches__fade--left {
  left: 0;
  background: linear-gradient(90deg, var(--black) 0%, transparent 100%);
}

.similar-watches__fade--right {
  right: 0;
  background: linear-gradient(270deg, var(--black) 0%, transparent 100%);
}

.similar-watches__arrow {
  position: absolute;
  top: 50%;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  transform: translateY(-50%);
  border: 1px solid rgba(200, 169, 110, 0.2);
  background: rgba(10, 10, 10, 0.65);
  color: var(--gold);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease, border-color 0.3s ease, background 0.3s ease;
}

.similar-watches__carousel:hover .similar-watches__arrow {
  opacity: 1;
}

.similar-watches__arrow:hover {
  border-color: rgba(200, 169, 110, 0.5);
  background: rgba(10, 10, 10, 0.9);
}

.similar-watches__arrow--prev {
  left: 8px;
}

.similar-watches__arrow--next {
  right: 8px;
}

.similar-watches__track {
  display: flex;
  gap: 16px;
  width: max-content;
  will-change: transform;
}

.similar-watches__slide {
  flex: 0 0 clamp(220px, 28vw, 320px);
  width: clamp(220px, 28vw, 320px);
  opacity: 0.92;
  transform: scale(0.98);
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.similar-watches__carousel:hover .similar-watches__slide {
  opacity: 1;
  transform: scale(1);
}

.similar-watches__slide :deep(.products-card) {
  width: 100%;
  border: 1px solid rgba(200, 169, 110, 0.06);
  transition: border-color 0.35s ease, box-shadow 0.35s ease;
}

.similar-watches__carousel:hover .similar-watches__slide :deep(.products-card) {
  border-color: rgba(200, 169, 110, 0.14);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.similar-watches__slide :deep(.products-img) {
  animation: related-watch-float 5s ease-in-out infinite;
  animation-delay: var(--slide-delay, 0s);
}

.similar-watches__slide :deep(.products-img img) {
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s ease;
}

.similar-watches__slide:hover :deep(.products-img img) {
  transform: translateY(-8px);
}

@keyframes related-watch-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

@media (max-width: 768px) {
  .similar-watches__arrow {
    opacity: 1;
    width: 44px;
    height: 44px;
  }
}

@media (max-width: 640px) {
  .similar-watches__slide {
    flex: 0 0 72vw;
    width: 72vw;
  }
}

.similar-watches--compact {
  margin-top: 12px;
  padding-top: 12px;
}

.similar-watches--compact .similar-watches__header {
  margin-bottom: 12px;
}

.similar-watches--compact .similar-watches__title {
  font-size: clamp(18px, 2.5vw, 24px);
}

.similar-watches--compact .similar-watches__slide {
  flex: 0 0 clamp(160px, 20vw, 220px);
  width: clamp(160px, 20vw, 220px);
}

@media (max-width: 640px) {
  .similar-watches--compact .similar-watches__slide {
    flex: 0 0 58vw;
    width: 58vw;
  }
}
</style>
