<script setup lang="ts">
import type { PosCatalogWatchDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';
import {
  fallbackGallery,
  photoInitials,
  stockBadge,
} from '~/utils/pos-catalog';

const props = defineProps<{
  watch: PosCatalogWatchDto;
  cartQty: number;
}>();

const emit = defineEmits<{
  add: [];
  openGallery: [];
}>();

const { resolve } = useMediaUrl();
const imageBroken = ref(false);

const imageSrc = computed(() => {
  if (imageBroken.value) return null;
  const raw = fallbackGallery(props.watch.gallery, props.watch.imageUrl)[0] ?? null;
  if (!raw) return null;
  return optimizeCloudinaryImageUrl(resolve(raw) ?? raw, 160);
});

const atLimit = computed(() => props.watch.stock <= 0 || props.cartQty >= props.watch.stock);
const addLabel = computed(() => {
  if (props.watch.stock <= 0) return 'Sin stock';
  if (atLimit.value) return 'Sin más unidades';
  return 'Agregar';
});
const initials = computed(() =>
  photoInitials(props.watch.brandName, props.watch.model),
);

watch(
  () => props.watch.id,
  () => {
    imageBroken.value = false;
  },
);
</script>

<template>
  <article class="pos-card admin-record-card">
    <button
      type="button"
      class="pos-card__media"
      :aria-label="`Ver fotos de ${watch.brandName} ${watch.model}`"
      @click="emit('openGallery')"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="`${watch.brandName} ${watch.model}`"
        loading="lazy"
        decoding="async"
        @error="imageBroken = true"
      >
      <span v-else class="pos-card__placeholder" aria-hidden="true">
        <span class="pos-card__initials">{{ initials }}</span>
      </span>
    </button>

    <div class="pos-card__body">
      <p class="pos-card__brand">{{ watch.brandName }}</p>
      <h3 class="pos-card__model">{{ watch.model }}</h3>
      <p class="pos-card__sku">{{ watch.sku }}</p>
      <p class="pos-card__price">{{ formatCop(watch.retailPrice) }}</p>

      <div class="pos-card__badges">
        <span
          class="pos-card__badge"
          :class="{ 'is-last': watch.stock === 1 }"
        >
          {{ stockBadge(watch.stock) }}
        </span>
        <span
          v-if="watch.limitedEditionNumber"
          class="pos-card__badge is-limited"
        >
          Edición limitada N.º {{ watch.limitedEditionNumber }}
        </span>
      </div>

      <button
        type="button"
        class="admin-record-btn admin-record-btn--primary pos-card__add"
        :disabled="atLimit"
        @click="emit('add')"
      >
        {{ addLabel }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.pos-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
  padding: 0.65rem;
}

.pos-card__media {
  flex: 0 0 auto;
  width: 100%;
  height: 140px;
  border: 0;
  border-radius: 4px;
  background: #f7f3ea;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
}

.pos-card__media img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
  border-radius: 4px;
}

.pos-card__placeholder {
  display: grid;
  place-content: center;
  width: 100%;
  height: 140px;
  border-radius: 4px;
  color: #8a7a5a;
  background: #f3eee3;
}

.pos-card__initials {
  font-family: var(--lux-font-display, Cormorant, Georgia, serif);
  font-size: 1rem;
  color: var(--lux-gold, #b8962e);
}

.pos-card__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.1rem 0.5rem;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0;
}

.pos-card__brand {
  margin: 0;
  color: var(--lux-gold, #b8962e);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  grid-column: 1;
}

.pos-card__model {
  margin: 0;
  font-family: var(--lux-font-display, Cormorant, Georgia, serif);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.15;
  grid-column: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pos-card__sku {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #6b7280;
  font-size: 0.72rem;
  grid-column: 1;
}

.pos-card__price {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  grid-column: 1;
}

.pos-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  grid-column: 1;
}

.pos-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(200, 169, 110, 0.14);
  color: #6b5a32;
  font-size: 0.72rem;
  font-weight: 600;
}

.pos-card__badge.is-last {
  background: rgba(180, 83, 9, 0.14);
  color: #b45309;
}

.pos-card__badge.is-limited {
  background: rgba(17, 24, 39, 0.08);
  color: #374151;
}

.pos-card__add {
  grid-column: 1 / -1;
  min-height: 36px;
  padding: 0.25rem 0.7rem;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .pos-card__media,
  .pos-card__media img,
  .pos-card__placeholder {
    flex-basis: 64px;
    width: 64px;
    height: 64px;
  }
}
</style>
