<script setup lang="ts">
import type { PosCatalogWatchDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';

const props = defineProps<{
  watch: PosCatalogWatchDto;
  cartQty: number;
}>();

const emit = defineEmits<{
  close: [];
  add: [];
}>();

const { resolve } = useMediaUrl();
const index = ref(0);
let touchX = 0;

const gallery = computed(() =>
  props.watch.gallery.length
    ? props.watch.gallery
    : props.watch.imageUrl
      ? [props.watch.imageUrl]
      : [],
);

const currentSrc = computed(() => {
  const raw = gallery.value[index.value];
  if (!raw) return null;
  return optimizeCloudinaryImageUrl(resolve(raw) ?? raw, 1200);
});

const atLimit = computed(() => props.cartQty >= props.watch.stock);

const warrantyLabel = computed(() =>
  props.watch.warrantyMonths > 0
    ? `${props.watch.warrantyMonths} meses`
    : 'Sin garantía',
);

function step(dir: -1 | 1) {
  if (gallery.value.length < 2) return;
  index.value =
    (index.value + dir + gallery.value.length) % gallery.value.length;
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    step(1);
  }
}

function onTouchStart(event: TouchEvent) {
  touchX = event.changedTouches[0]?.clientX ?? 0;
}

function onTouchEnd(event: TouchEvent) {
  const x = event.changedTouches[0]?.clientX ?? 0;
  const delta = x - touchX;
  if (Math.abs(delta) < 40) return;
  step(delta < 0 ? 1 : -1);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div
      class="pos-gallery"
      role="dialog"
      aria-modal="true"
      :aria-label="`${watch.brandName} ${watch.model}`"
      @click.self="emit('close')"
    >
      <button
        type="button"
        class="pos-gallery__close"
        aria-label="Cerrar"
        @click="emit('close')"
      >
        ×
      </button>
      <div class="pos-gallery__layout">
        <div
          class="pos-gallery__viewer"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <button
            v-if="gallery.length > 1"
            type="button"
            class="pos-gallery__nav"
            aria-label="Anterior"
            @click="step(-1)"
          >
            ‹
          </button>
          <img
            v-if="currentSrc"
            :src="currentSrc"
            :alt="`${watch.brandName} ${watch.model}`"
            draggable="false"
          >
          <button
            v-if="gallery.length > 1"
            type="button"
            class="pos-gallery__nav"
            aria-label="Siguiente"
            @click="step(1)"
          >
            ›
          </button>
        </div>
        <div v-if="gallery.length > 1" class="pos-gallery__thumbs">
          <button
            v-for="(url, i) in gallery"
            :key="`${url}-${i}`"
            type="button"
            class="pos-gallery__thumb"
            :class="{ 'is-active': i === index }"
            @click="index = i"
          >
            <img
              :src="optimizeCloudinaryImageUrl(resolve(url) ?? url, 120)"
              alt=""
            >
          </button>
        </div>
        <aside class="pos-gallery__info">
          <p class="pos-gallery__brand">{{ watch.brandName }}</p>
          <h2>{{ watch.model }}</h2>
          <p class="pos-gallery__sku">{{ watch.sku }}</p>
          <p v-if="watch.reference">Ref: {{ watch.reference }}</p>
          <p class="pos-gallery__price">{{ formatCop(watch.retailPrice) }}</p>
          <ul class="pos-gallery__meta">
            <li v-if="watch.dialColor">Esfera: {{ watch.dialColor }}</li>
            <li v-if="watch.strapMaterial">Correa: {{ watch.strapMaterial }}</li>
            <li v-if="watch.caseMaterial">Caja: {{ watch.caseMaterial }}</li>
            <li v-if="watch.movementType">Movimiento: {{ watch.movementType }}</li>
            <li>Garantía: {{ warrantyLabel }}</li>
            <li>Disponibles: {{ watch.stock }}</li>
          </ul>
          <button
            type="button"
            class="admin-btn admin-btn-primary"
            :disabled="atLimit"
            @click="emit('add')"
          >
            {{ atLimit ? 'Sin más unidades' : 'Agregar al carrito' }}
          </button>
        </aside>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pos-gallery {
  position: fixed;
  inset: 0;
  z-index: 120000;
  background: rgba(10, 10, 10, 0.92);
  color: #fff;
  overflow: auto;
  padding: 1rem;
}

.pos-gallery__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  font-size: 1.6rem;
  cursor: pointer;
}

.pos-gallery__layout {
  display: grid;
  gap: 1rem;
  max-width: 1100px;
  margin: 3rem auto 1rem;
}

@media (min-width: 900px) {
  .pos-gallery__layout {
    grid-template-columns: 1.4fr 0.8fr;
    align-items: start;
  }
}

.pos-gallery__viewer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 280px;
}

.pos-gallery__viewer img {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  background: #111;
}

.pos-gallery__nav {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
}

.pos-gallery__thumbs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  grid-column: 1 / -1;
}

.pos-gallery__thumb {
  width: 64px;
  height: 64px;
  padding: 0;
  border: 2px solid transparent;
  background: #fff;
  cursor: pointer;
}

.pos-gallery__thumb.is-active {
  border-color: #b8962e;
}

.pos-gallery__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.pos-gallery__brand {
  margin: 0;
  color: #b8962e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

.pos-gallery__info h2 {
  margin: 0.25rem 0;
}

.pos-gallery__sku {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #d1d5db;
}

.pos-gallery__price {
  font-size: 1.4rem;
  font-weight: 700;
}

.pos-gallery__meta {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.35rem;
  color: #e5e7eb;
}

.pos-gallery__info .admin-btn {
  min-height: 48px;
  width: 100%;
}
</style>
