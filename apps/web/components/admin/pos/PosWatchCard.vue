<script setup lang="ts">
import type { PosCatalogWatchDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';

const props = defineProps<{
  watch: PosCatalogWatchDto;
  cartQty: number;
}>();

const emit = defineEmits<{
  add: [];
  openGallery: [];
}>();

const { resolve } = useMediaUrl();

const imageSrc = computed(() => {
  const raw = props.watch.imageUrl ?? props.watch.gallery[0] ?? null;
  if (!raw) return null;
  return optimizeCloudinaryImageUrl(resolve(raw) ?? raw, 480);
});

const atLimit = computed(() => props.cartQty >= props.watch.stock);
</script>

<template>
  <article class="pos-card">
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
      >
      <span v-else class="pos-card__placeholder">Sin foto</span>
    </button>
    <p class="pos-card__brand">{{ watch.brandName }}</p>
    <h3 class="pos-card__model">{{ watch.model }}</h3>
    <p class="pos-card__sku">{{ watch.sku }}</p>
    <p class="pos-card__price">{{ formatCop(watch.retailPrice) }}</p>
    <p
      class="pos-card__stock"
      :class="{ 'is-last': watch.stock === 1 }"
    >
      {{ watch.stock === 1 ? 'Última unidad' : `Disponibles: ${watch.stock}` }}
    </p>
    <button
      type="button"
      class="admin-btn admin-btn-primary pos-card__add"
      :disabled="atLimit"
      @click="emit('add')"
    >
      {{ atLimit ? 'Sin más unidades' : 'Agregar' }}
    </button>
  </article>
</template>

<style scoped>
.pos-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.pos-card__media {
  aspect-ratio: 1;
  width: 100%;
  border: 1px solid var(--admin-border, #e5e7eb);
  background: #fff;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  min-height: 44px;
}

.pos-card__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.pos-card__placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: #9ca3af;
  font-size: 0.85rem;
}

.pos-card__brand {
  margin: 0.25rem 0 0;
  color: var(--admin-gold, #b8962e);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pos-card__model {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}

.pos-card__sku {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #6b7280;
  font-size: 0.8rem;
}

.pos-card__price {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.pos-card__stock {
  margin: 0;
  font-size: 0.82rem;
  color: #4b5563;
}

.pos-card__stock.is-last {
  color: #b45309;
  font-weight: 600;
}

.pos-card__add {
  margin-top: 0.35rem;
  width: 100%;
  min-height: 48px;
}
</style>
