<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = defineProps<{
  watch: WatchPublicDto;
}>();

const { watchPrimaryImage, watchSecondaryImage, watchVideoUrl } = useMediaUrl();
const cart = useWholesaleCartStore();
const analytics = useAnalytics();

const slides = computed(() => {
  const result: { type: 'image' | 'video'; url: string }[] = [];
  const front = watchPrimaryImage(props.watch);
  const back = watchSecondaryImage(props.watch);
  const video = watchVideoUrl(props.watch);
  if (front) result.push({ type: 'image', url: front });
  if (back && back !== front) result.push({ type: 'image', url: back });
  if (video) result.push({ type: 'video', url: video });
  return result;
});

const currentIndex = ref(0);
const lightboxOpen = ref(false);
const lightboxUrl = ref('');

function prev() {
  if (slides.value.length <= 1) return;
  currentIndex.value = (currentIndex.value - 1 + slides.value.length) % slides.value.length;
}

function next() {
  if (slides.value.length <= 1) return;
  currentIndex.value = (currentIndex.value + 1) % slides.value.length;
}

function openLightbox(url: string) {
  lightboxUrl.value = url;
  lightboxOpen.value = true;
}

function closeLightbox() {
  lightboxOpen.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function addToCart() {
  cart.addFromWatch(props.watch);
  analytics.track('add_to_cart', { slug: props.watch.slug, channel: 'wholesale' });
}

const displayPrice = computed(() => props.watch.wholesalePrice ?? props.watch.retailPrice);

const stockLabel = computed(() => {
  if (props.watch.stock === 0) return 'Agotado';
  return `Stock: ${props.watch.stock}`;
});

const stockTone = computed(() => {
  if (props.watch.stock === 0) return 'out';
  if (props.watch.stock <= 3) return 'low';
  return 'ok';
});
</script>

<template>
  <div class="wholesale-watch-card">
    <!-- Carrusel de medios -->
    <div v-if="slides.length" class="ww-carousel">
      <div class="ww-carousel-track">
        <div
          v-for="(slide, i) in slides"
          v-show="i === currentIndex"
          :key="i"
          class="ww-slide"
        >
          <video
            v-if="slide.type === 'video'"
            :src="slide.url"
            class="ww-media"
            controls
            preload="none"
            :poster="slides[0]?.type === 'image' ? slides[0].url : undefined"
          />
          <img
            v-else
            :src="slide.url"
            :alt="`${watch.brand.name} ${watch.model}`"
            class="ww-media ww-media-img"
            loading="lazy"
            @click="openLightbox(slide.url)"
          >
        </div>
      </div>

      <button
        v-if="slides.length > 1"
        type="button"
        class="ww-arrow ww-arrow-prev"
        aria-label="Anterior"
        @click.stop="prev"
      >‹</button>
      <button
        v-if="slides.length > 1"
        type="button"
        class="ww-arrow ww-arrow-next"
        aria-label="Siguiente"
        @click.stop="next"
      >›</button>

      <div v-if="slides.length > 1" class="ww-dots">
        <button
          v-for="(_, i) in slides"
          :key="i"
          type="button"
          class="ww-dot"
          :class="{ 'ww-dot--active': i === currentIndex }"
          :aria-label="`Imagen ${i + 1}`"
          @click.stop="currentIndex = i"
        />
      </div>
    </div>
    <div v-else class="ww-no-image" />

    <!-- Información del reloj -->
    <div class="ww-info">
      <div class="ww-info-head">
        <span class="ww-brand">{{ watch.brand.name }}</span>
        <span class="ww-stock-badge" :class="`ww-stock--${stockTone}`">{{ stockLabel }}</span>
      </div>

      <h3 class="ww-model">{{ watch.model }}</h3>
      <p class="ww-movement">
        {{ watch.movementType }}<span v-if="watch.reference"> · Ref. {{ watch.reference }}</span>
      </p>

      <p class="ww-price">{{ formatCop(displayPrice) }}</p>
      <p
        v-if="watch.wholesalePrice && watch.wholesalePrice !== watch.retailPrice"
        class="ww-retail-price"
      >
        P.V.P.: {{ formatCop(watch.retailPrice) }}
      </p>

      <p v-if="watch.description" class="ww-description">{{ watch.description }}</p>

      <button
        type="button"
        class="ww-add-btn"
        :disabled="watch.stock === 0"
        @click="addToCart"
      >
        {{ watch.stock === 0 ? 'Agotado' : 'Agregar al carrito' }}
      </button>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="ww-lightbox"
        @click="closeLightbox"
      >
        <img
          :src="lightboxUrl"
          class="ww-lightbox-img"
          alt="Imagen ampliada"
          @click.stop
        >
        <button
          type="button"
          class="ww-lightbox-close"
          aria-label="Cerrar"
          @click="closeLightbox"
        >×</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wholesale-watch-card {
  background: var(--black-2, #111);
  border: 1px solid rgba(200, 169, 110, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Carrusel ── */
.ww-carousel {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--black-3, #0a0a0a);
}

.ww-carousel-track {
  width: 100%;
  height: 380px;
}

.ww-slide {
  width: 100%;
  height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ww-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ww-media-img {
  cursor: zoom-in;
}

.ww-no-image {
  width: 100%;
  height: 300px;
  background: var(--black-3, #0a0a0a);
}

/* ── Flechas ── */
.ww-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.55);
  border: none;
  color: #fff;
  font-size: 26px;
  line-height: 1;
  width: 34px;
  height: 34px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.15s;
}

.ww-arrow:hover {
  background: rgba(200, 169, 110, 0.4);
}

.ww-arrow-prev { left: 8px; }
.ww-arrow-next { right: 8px; }

/* ── Puntos ── */
.ww-dots {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 2;
}

.ww-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.ww-dot--active {
  background: rgba(200, 169, 110, 0.9);
}

/* ── Info ── */
.ww-info {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.ww-info-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ww-brand {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-dim, rgba(255, 255, 255, 0.45));
}

.ww-stock-badge {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 2px;
}

.ww-stock--ok {
  background: rgba(74, 222, 128, 0.1);
  color: rgb(74, 222, 128);
  border: 1px solid rgba(74, 222, 128, 0.25);
}

.ww-stock--low {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.ww-stock--out {
  background: rgba(248, 113, 113, 0.1);
  color: rgb(248, 113, 113);
  border: 1px solid rgba(248, 113, 113, 0.25);
}

.ww-model {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.2;
  color: var(--white, #fff);
  margin: 2px 0 0;
}

.ww-movement {
  font-size: 12px;
  color: var(--white-dim, rgba(255, 255, 255, 0.45));
  margin: 0;
}

.ww-price {
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--gold, #c8a96e);
  margin: 4px 0 0;
}

.ww-retail-price {
  font-size: 11px;
  color: var(--white-dim, rgba(255, 255, 255, 0.4));
  margin: 0;
}

.ww-description {
  font-size: 13px;
  color: var(--white-dim, rgba(255, 255, 255, 0.6));
  line-height: 1.55;
  margin: 4px 0 8px;
}

.ww-add-btn {
  margin-top: auto;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid rgba(200, 169, 110, 0.5);
  color: var(--gold, #c8a96e);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  width: 100%;
  text-align: center;
}

.ww-add-btn:hover:not(:disabled) {
  background: rgba(200, 169, 110, 0.1);
}

.ww-add-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Lightbox ── */
.ww-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.ww-lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  cursor: default;
}

.ww-lightbox-close {
  position: absolute;
  top: 16px;
  right: 20px;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 36px;
  cursor: pointer;
  line-height: 1;
  opacity: 0.8;
}

.ww-lightbox-close:hover {
  opacity: 1;
}
</style>
