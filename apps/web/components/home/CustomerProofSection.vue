<script setup lang="ts">
import type { HomepageCustomerProofConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageCustomerProofConfig }>();

const images = computed(() =>
  (props.config.images ?? []).filter((item) => item.url?.trim()),
);

const lightboxUrl = ref<string | null>(null);

function openLightbox(url: string) {
  lightboxUrl.value = url;
}

function closeLightbox() {
  lightboxUrl.value = null;
}
</script>

<template>
  <section v-if="images.length" id="reseñas" class="lux-proof">
    <div class="lux-proof__inner">
      <header class="lux-proof__header reveal">
        <p class="lux-proof__label">{{ config.label }}</p>
        <h2 class="lux-proof__title">
          {{ config.title }}
          <em>{{ config.titleEm }}</em>
        </h2>
        <p v-if="config.subtitle" class="lux-proof__subtitle">{{ config.subtitle }}</p>
      </header>

      <div class="lux-proof__grid reveal">
        <figure
          v-for="(item, i) in images"
          :key="`${item.url}-${i}`"
          class="lux-proof__item"
          :class="`lux-proof__item--${(i % 5) + 1}`"
        >
          <button type="button" class="lux-proof__thumb" @click="openLightbox(item.url)">
            <img :src="item.url.trim()" :alt="item.caption || 'Entrega LUXTIMEE'" loading="lazy" decoding="async">
          </button>
          <figcaption v-if="item.caption" class="lux-proof__caption">{{ item.caption }}</figcaption>
        </figure>
      </div>
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

.lux-proof__grid {
  columns: 2;
  column-gap: 14px;
}

.lux-proof__item {
  break-inside: avoid;
  margin-bottom: 14px;
  display: block;
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
  height: auto;
  display: block;
  object-fit: cover;
}

.lux-proof__item--1 .lux-proof__thumb img { aspect-ratio: 4 / 5; }
.lux-proof__item--2 .lux-proof__thumb img { aspect-ratio: 1 / 1; }
.lux-proof__item--3 .lux-proof__thumb img { aspect-ratio: 3 / 4; }
.lux-proof__item--4 .lux-proof__thumb img { aspect-ratio: 16 / 11; }
.lux-proof__item--5 .lux-proof__thumb img { aspect-ratio: 5 / 6; }

.lux-proof__caption {
  margin-top: 0.5rem;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--white-dim);
  line-height: 1.5;
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

@media (min-width: 768px) {
  .lux-proof__grid {
    columns: 3;
    column-gap: 18px;
  }
}

@media (min-width: 1100px) {
  .lux-proof__grid {
    columns: 4;
  }
}
</style>
