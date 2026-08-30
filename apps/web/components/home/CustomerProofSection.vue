<script setup lang="ts">
import type { HomepageCustomerProofConfig } from '@luxtime/shared';
import { normalizeCustomerProofImages } from '~/utils/homepage-config';

const LOOP_COPIES = 4;

const props = defineProps<{ config: HomepageCustomerProofConfig }>();

const images = computed(() => normalizeCustomerProofImages(props.config.images));
const loopedImages = computed(() => {
  if (!images.value.length) return [];
  return Array.from({ length: LOOP_COPIES }, () => images.value).flat();
});

const lightboxUrl = ref<string | null>(null);
const cycleSeconds = ref(28);

const {
  viewport,
  track,
  initCarousel,
  pause,
  resume,
  onTouchEnd,
  scrollByCards,
  onManualScroll,
} = useInfiniteHorizontalScroll({ cycleSeconds, enabled: computed(() => images.value.length > 1), loopCopies: LOOP_COPIES });

function openLightbox(url: string) {
  lightboxUrl.value = url;
}

function closeLightbox() {
  lightboxUrl.value = null;
}

watch(images, () => initCarousel(), { deep: true });
</script>

<template>
  <section id="reseñas" class="lux-proof">
    <div class="lux-proof__inner">
      <header class="lux-proof__header reveal">
        <p class="lux-proof__label">{{ config.label }}</p>
        <h2 class="lux-proof__title">
          {{ config.title }}
          <em>{{ config.titleEm }}</em>
        </h2>
        <p v-if="config.subtitle" class="lux-proof__subtitle">{{ config.subtitle }}</p>
      </header>

      <div
        v-if="images.length"
        class="lux-proof__carousel reveal"
        @mouseenter="pause"
        @mouseleave="resume"
      >
        <div class="lux-proof__fade lux-proof__fade--left" aria-hidden="true" />
        <div class="lux-proof__fade lux-proof__fade--right" aria-hidden="true" />

        <button
          v-if="images.length > 1"
          type="button"
          class="lux-proof__arrow lux-proof__arrow--prev"
          aria-label="Anterior"
          @click="scrollByCards(-1)"
        >
          ‹
        </button>
        <button
          v-if="images.length > 1"
          type="button"
          class="lux-proof__arrow lux-proof__arrow--next"
          aria-label="Siguiente"
          @click="scrollByCards(1)"
        >
          ›
        </button>

        <div
          ref="viewport"
          class="lux-proof__viewport"
          @touchstart.passive="pause"
          @touchend.passive="onTouchEnd"
          @scroll.passive="onManualScroll"
        >
          <div ref="track" class="lux-proof__track">
            <figure
              v-for="(item, i) in loopedImages"
              :key="`${item.url}-${i}`"
              class="lux-proof__slide"
            >
              <button type="button" class="lux-proof__thumb" @click="openLightbox(item.url)">
                <img :src="item.url.trim()" :alt="item.caption || 'Entrega LUXTIMEE'" loading="lazy" decoding="async">
              </button>
              <figcaption v-if="item.caption" class="lux-proof__caption">{{ item.caption }}</figcaption>
            </figure>
          </div>
        </div>
      </div>
      <p v-else class="lux-proof__empty reveal">Próximamente más entregas documentadas.</p>
    </div>

    <Teleport to="body">
      <div v-if="lightboxUrl" class="lux-proof-lightbox" @click="closeLightbox">
        <button type="button" class="lux-proof-lightbox__close" aria-label="Cerrar" @click="closeLightbox">×</button>
        <img :src="lightboxUrl" alt="Entrega LUXTIMEE" @click.stop>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.lux-proof {
  position: relative;
  padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 6vw, 5rem);
  background: linear-gradient(180deg, var(--black) 0%, var(--black-2) 100%);
  border-top: 1px solid rgba(200, 169, 110, 0.1);
  overflow: hidden;
}

.lux-proof__inner {
  max-width: 1280px;
  margin: 0 auto;
}

.lux-proof__header {
  text-align: center;
  margin-bottom: clamp(2rem, 4vw, 3rem);
}

.lux-proof__label {
  font-size: 10px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 0.85rem;
}

.lux-proof__title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.25rem);
  font-weight: 300;
  color: var(--white);
  line-height: 1.15;
}

.lux-proof__title em {
  font-style: italic;
  color: var(--gold);
}

.lux-proof__subtitle {
  margin-top: 1rem;
  max-width: 560px;
  margin-inline: auto;
  font-size: 0.9rem;
  line-height: 1.75;
  color: var(--white-dim);
}

.lux-proof__empty {
  text-align: center;
  font-size: 0.85rem;
  color: var(--white-dim);
  letter-spacing: 0.06em;
}

.lux-proof__carousel {
  position: relative;
}

.lux-proof__viewport {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 0 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.lux-proof__viewport::-webkit-scrollbar {
  display: none;
}

.lux-proof__track {
  display: flex;
  gap: 16px;
  width: max-content;
}

.lux-proof__slide {
  flex: 0 0 clamp(220px, 28vw, 320px);
  width: clamp(220px, 28vw, 320px);
  margin: 0;
}

.lux-proof__thumb {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.18);
  background: var(--black-3);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color 0.3s, transform 0.3s;
}

.lux-proof__thumb:hover {
  border-color: rgba(200, 169, 110, 0.45);
  transform: translateY(-2px);
}

.lux-proof__thumb img {
  width: 100%;
  aspect-ratio: 4 / 5;
  display: block;
  object-fit: cover;
}

.lux-proof__caption {
  margin-top: 0.5rem;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--white-dim);
  line-height: 1.5;
  text-align: center;
}

.lux-proof__fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12%;
  z-index: 2;
  pointer-events: none;
}

.lux-proof__fade--left {
  left: 0;
  background: linear-gradient(90deg, var(--black-2) 0%, transparent 100%);
}

.lux-proof__fade--right {
  right: 0;
  background: linear-gradient(270deg, var(--black-2) 0%, transparent 100%);
}

.lux-proof__arrow {
  position: absolute;
  top: 42%;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  transform: translateY(-50%);
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: rgba(10, 10, 10, 0.72);
  color: var(--gold);
  font-size: 22px;
  cursor: pointer;
}

.lux-proof__arrow--prev {
  left: 4px;
}

.lux-proof__arrow--next {
  right: 4px;
}

.lux-proof-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.lux-proof-lightbox img {
  max-width: min(920px, 100%);
  max-height: 90vh;
  object-fit: contain;
  border: 1px solid rgba(200, 169, 110, 0.25);
}

.lux-proof-lightbox__close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--white);
  font-size: 24px;
  cursor: pointer;
}

@media (max-width: 640px) {
  .lux-proof__slide {
    flex: 0 0 72vw;
    width: 72vw;
  }
}
</style>
