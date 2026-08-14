<script setup lang="ts">
type GallerySlide = {
  key: string;
  type: 'image' | 'video';
  src: string;
  label: string;
};

const props = defineProps<{
  frontUrl?: string | null;
  backUrl?: string | null;
  videoUrl?: string | null;
  alt: string;
}>();

const activeIndex = ref(0);
const touchStartX = ref(0);

const slides = computed<GallerySlide[]>(() => {
  const items: GallerySlide[] = [];
  if (props.frontUrl) items.push({ key: 'front', type: 'image', src: props.frontUrl, label: 'Frontal' });
  if (props.backUrl) items.push({ key: 'back', type: 'image', src: props.backUrl, label: 'Trasera' });
  if (props.videoUrl) items.push({ key: 'video', type: 'video', src: props.videoUrl, label: 'Video' });
  return items;
});

const activeSlide = computed(() => slides.value[activeIndex.value] ?? slides.value[0] ?? null);

watch(slides, (next) => {
  if (activeIndex.value >= next.length) activeIndex.value = 0;
});

function goTo(index: number) {
  if (!slides.value.length) return;
  activeIndex.value = (index + slides.value.length) % slides.value.length;
}

function prev() {
  goTo(activeIndex.value - 1);
}

function next() {
  goTo(activeIndex.value + 1);
}

function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.changedTouches[0]?.clientX ?? 0;
}

function onTouchEnd(e: TouchEvent) {
  const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.value;
  if (Math.abs(delta) < 40) return;
  if (delta < 0) next();
  else prev();
}
</script>

<template>
  <div v-if="slides.length" class="product-gallery">
    <div
      class="product-gallery__stage"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <button
        v-if="slides.length > 1"
        type="button"
        class="product-gallery__arrow product-gallery__arrow--prev"
        aria-label="Anterior"
        @click="prev"
      >
        ‹
      </button>
      <button
        v-if="slides.length > 1"
        type="button"
        class="product-gallery__arrow product-gallery__arrow--next"
        aria-label="Siguiente"
        @click="next"
      >
        ›
      </button>

      <Transition name="product-gallery-fade" mode="out-in">
        <video
          v-if="activeSlide?.type === 'video'"
          :key="activeSlide.key"
          :src="activeSlide.src"
          class="product-gallery__media"
          controls
          playsinline
        />
        <img
          v-else-if="activeSlide"
          :key="activeSlide.key"
          :src="activeSlide.src"
          :alt="alt"
          class="product-gallery__media"
        >
      </Transition>
    </div>

    <div v-if="slides.length > 1" class="product-gallery__dots" role="tablist" aria-label="Galería del reloj">
      <button
        v-for="(slide, i) in slides"
        :key="slide.key"
        type="button"
        class="product-gallery__dot"
        :class="{ 'product-gallery__dot--active': i === activeIndex }"
        :aria-label="slide.label"
        :aria-selected="i === activeIndex"
        role="tab"
        @click="goTo(i)"
      />
    </div>

    <div v-if="slides.length > 1" class="product-gallery__tabs">
      <button
        v-for="(slide, i) in slides"
        :key="`${slide.key}-tab`"
        type="button"
        class="product-gallery__tab"
        :class="{ 'product-gallery__tab--active': i === activeIndex }"
        @click="goTo(i)"
      >
        {{ slide.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.product-gallery {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 358px;
  margin: 0 auto;
}

.product-gallery__stage {
  position: relative;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--black-2);
  border: var(--border-hairline);
}

.product-gallery__media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-gallery__arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  transform: translateY(-50%);
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: rgba(10, 10, 10, 0.72);
  color: var(--gold);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.product-gallery__arrow--prev {
  left: 8px;
}

.product-gallery__arrow--next {
  right: 8px;
}

.product-gallery__dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.product-gallery__dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(200, 169, 110, 0.25);
  cursor: pointer;
  transition: background 0.25s, transform 0.25s;
}

.product-gallery__dot--active {
  background: var(--gold);
  transform: scale(1.15);
}

.product-gallery__tabs {
  display: flex;
  gap: 8px;
}

.product-gallery__tab {
  flex: 1;
  padding: 12px 10px;
  background: rgba(200, 169, 110, 0.08);
  border: 1px solid rgba(200, 169, 110, 0.22);
  border-radius: 2px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-dim);
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s, background 0.25s;
}

.product-gallery__tab:hover {
  color: var(--white);
  background: rgba(200, 169, 110, 0.12);
  border-color: rgba(200, 169, 110, 0.35);
}

.product-gallery__tab--active {
  color: var(--gold);
  background: rgba(200, 169, 110, 0.18);
  border-color: rgba(200, 169, 110, 0.55);
  box-shadow: 0 0 0 1px rgba(200, 169, 110, 0.15);
}

.product-gallery-fade-enter-active,
.product-gallery-fade-leave-active {
  transition: opacity 0.25s ease;
}

.product-gallery-fade-enter-from,
.product-gallery-fade-leave-to {
  opacity: 0;
}
</style>
