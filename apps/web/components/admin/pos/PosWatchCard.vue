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
  return optimizeCloudinaryImageUrl(resolve(raw) ?? raw, 480);
});

const atLimit = computed(() => props.cartQty >= props.watch.stock);
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
        <span>Sin foto</span>
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
        {{ atLimit ? 'Sin más unidades' : 'Agregar' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.pos-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  overflow: hidden;
  padding: 0;
}

.pos-card__media {
  aspect-ratio: 1;
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(200, 169, 110, 0.18);
  background: #f7f3ea;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  min-height: 44px;
}

.pos-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pos-card__placeholder {
  display: grid;
  place-content: center;
  gap: 0.35rem;
  height: 100%;
  color: #8a7a5a;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-align: center;
  background: #f3eee3;
}

.pos-card__initials {
  font-family: var(--lux-font-display, Cormorant, Georgia, serif);
  font-size: 1.6rem;
  color: var(--lux-gold, #b8962e);
}

.pos-card__body {
  display: grid;
  gap: 0.3rem;
  padding: 0.75rem 0.8rem 0.85rem;
}

.pos-card__brand {
  margin: 0;
  color: var(--lux-gold, #b8962e);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.pos-card__model {
  margin: 0;
  font-family: var(--lux-font-display, Cormorant, Georgia, serif);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
}

.pos-card__sku {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #6b7280;
  font-size: 0.78rem;
}

.pos-card__price {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.pos-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
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
  margin-top: 0.45rem;
  width: 100%;
  min-height: 44px;
}
</style>
