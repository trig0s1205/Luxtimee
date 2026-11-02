<script setup lang="ts">
import type { PackagingPhotoDto } from '@luxtime/shared';
import { packagingImageSrc, packagingImageSrcSet } from '~/utils/packaging-gallery';

const props = defineProps<{ photos: PackagingPhotoDto[] }>();

const { resolve } = useMediaUrl();
const scroller = ref<HTMLElement | null>(null);
const activeIndex = ref<number | null>(null);

function source(url: string) {
  return resolve(url) ?? url;
}

function thumb(url: string) {
  return packagingImageSrc(source(url), 640);
}

function srcset(url: string) {
  return packagingImageSrcSet(source(url), [480, 720, 960]);
}

function alt(photo: PackagingPhotoDto) {
  return photo.caption?.trim() || 'Empaque del reloj: caja, paño y presentación LUXTIMEE';
}

function openAt(index: number) {
  activeIndex.value = index;
}

function scrollByCard(direction: -1 | 1) {
  const el = scroller.value;
  if (!el) return;
  const card = el.querySelector<HTMLElement>('.lux-pack__card');
  const step = (card?.offsetWidth ?? 240) + 12;
  el.scrollBy({ left: direction * step, behavior: 'smooth' });
}
</script>

<template>
  <section id="empaque" class="lux-pack" aria-labelledby="packaging-title">
    <div class="lux-pack__inner">
      <header class="lux-pack__header">
        <p class="lux-pack__label">Empaque</p>
        <h2 id="packaging-title" class="lux-pack__title">Así llega tu reloj</h2>
        <p class="lux-pack__subtitle">
          Caja, paño, pilas y la presentación con la que sale de LUXTIMEE.
        </p>
      </header>

      <div class="lux-pack__frame">
        <button
          v-if="photos.length > 1"
          type="button"
          class="lux-pack__arrow lux-pack__arrow--prev"
          aria-label="Fotos anteriores"
          @click="scrollByCard(-1)"
        >
          ‹
        </button>
        <div ref="scroller" class="lux-pack__scroller">
          <figure
            v-for="(photo, index) in props.photos"
            :key="photo.id"
            class="lux-pack__card"
          >
            <button
              type="button"
              class="lux-pack__thumb"
              :aria-label="`Ampliar foto${photo.caption?.trim() ? `: ${photo.caption.trim()}` : ''}`"
              @click="openAt(index)"
            >
              <img
                :src="thumb(photo.imageUrl)"
                :srcset="srcset(photo.imageUrl)"
                sizes="(max-width: 719px) 78vw, 25vw"
                :alt="alt(photo)"
                width="640"
                height="800"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                draggable="false"
              >
            </button>
            <figcaption v-if="photo.caption?.trim()" class="lux-pack__caption">
              {{ photo.caption.trim() }}
            </figcaption>
          </figure>
        </div>
        <button
          v-if="photos.length > 1"
          type="button"
          class="lux-pack__arrow lux-pack__arrow--next"
          aria-label="Fotos siguientes"
          @click="scrollByCard(1)"
        >
          ›
        </button>
      </div>
    </div>

    <HomePackagingLightbox
      v-if="activeIndex !== null"
      :photos="props.photos"
      :start-index="activeIndex"
      @close="activeIndex = null"
    />
  </section>
</template>

<style scoped>
.lux-pack {
  content-visibility: auto;
  contain-intrinsic-size: auto 720px;
  padding: clamp(4rem, 8vw, 6.5rem) clamp(1.25rem, 5vw, 4rem);
  background: var(--black);
  border-top: 1px solid rgba(200, 169, 110, 0.14);
}

.lux-pack__inner {
  max-width: 1280px;
  margin: 0 auto;
}

.lux-pack__header {
  max-width: 640px;
  margin: 0 auto clamp(1.75rem, 4vw, 2.75rem);
  text-align: center;
}

.lux-pack__label {
  margin: 0 0 0.75rem;
  font-size: 10px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: var(--gold);
}

.lux-pack__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.15rem);
  font-weight: 400;
  line-height: 1.1;
  color: var(--white);
}

.lux-pack__subtitle {
  margin: 0.9rem 0 0;
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--white-dim);
}

.lux-pack__frame {
  position: relative;
}

.lux-pack__scroller {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.lux-pack__scroller::-webkit-scrollbar {
  display: none;
}

.lux-pack__card {
  flex: 0 0 min(78vw, 280px);
  width: min(78vw, 280px);
  margin: 0;
  scroll-snap-align: start;
}

.lux-pack__thumb {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.22);
  background: var(--black-3);
  cursor: zoom-in;
  overflow: hidden;
}

.lux-pack__thumb img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
  object-fit: cover;
}

.lux-pack__caption {
  margin-top: 0.55rem;
  text-align: center;
  font-size: 12px;
  line-height: 1.45;
  letter-spacing: 0.04em;
  color: var(--white-dim);
}

.lux-pack__arrow {
  display: none;
}

@media (max-width: 719px) {
  .lux-pack__arrow {
    position: absolute;
    top: 38%;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid rgba(200, 169, 110, 0.35);
    background: rgba(255, 255, 255, 0.88);
    color: var(--gold-dark);
    font-size: 22px;
    cursor: pointer;
  }

  .lux-pack__arrow--prev { left: 0; }
  .lux-pack__arrow--next { right: 0; }
}

@media (min-width: 720px) {
  .lux-pack__scroller {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: visible;
    scroll-snap-type: none;
  }

  .lux-pack__card {
    flex: none;
    width: auto;
  }
}

@media (min-width: 1100px) {
  .lux-pack__scroller {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
