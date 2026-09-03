<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';

const props = defineProps<{
  watch: WatchPublicDto;
  delay?: number;
}>();

const emit = defineEmits<{
  select: [watch: WatchPublicDto];
  add: [watch: WatchPublicDto];
}>();

const { openProduct } = useProductModal();
const cart = useCartStore();
const { t } = useLocale();
const { watchPrimaryImage } = useMediaUrl();

const imageUrl = computed(() => optimizeCloudinaryImageUrl(watchPrimaryImage(props.watch), 480));

const showLimitedEdition = computed(() => props.watch.isLimitedEdition && props.watch.stock > 0);
const stockLabel = computed(() => {
  if (props.watch.stock <= 0) return null;
  if (props.watch.stock <= 3) {
    return t('product.stockLeft').replace('{n}', String(props.watch.stock));
  }
  return t('product.stockUnits').replace('{n}', String(props.watch.stock));
});

function onCardClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.add-btn')) return;
  openProduct(props.watch.slug);
  emit('select', props.watch);
}

function onAdd(e: Event) {
  e.stopPropagation();
  cart.addFromWatch(props.watch);
  emit('add', props.watch);
  const btn = (e.currentTarget as HTMLButtonElement);
  const orig = btn.textContent;
  btn.textContent = '✓';
  btn.classList.add('added');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('added');
  }, 1500);
}
</script>

<template>
  <article
    class="products-card reveal"
    :style="delay != null ? { transitionDelay: `${delay}s` } : undefined"
    @click="onCardClick"
  >
    <div class="products-img">
      <div
        v-if="showLimitedEdition || stockLabel"
        class="products-img-badges"
        :class="{ 'products-img-badges--solo-stock': stockLabel && !showLimitedEdition }"
      >
        <span v-if="showLimitedEdition" class="badge-limited badge-limited--card">{{ t('product.limitedBadge') }}</span>
        <span v-if="stockLabel" class="product-stock-badge">{{ stockLabel }}</span>
      </div>
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="`${watch.brand.name} ${watch.model}`"
        loading="lazy"
      >
      <div v-else class="watch-placeholder" />
    </div>
    <div class="products-info">
      <p class="products-tag">{{ watch.brand.name }}</p>
      <h3 class="products-name">{{ watch.model }}</h3>
      <p class="products-ref">{{ watch.movementType }}</p>
      <div class="products-bottom">
        <p class="products-price">{{ formatCop(watch.retailPrice) }}</p>
        <button type="button" class="add-btn" :aria-label="t('product.add')" @click="onAdd">+</button>
      </div>
    </div>
  </article>
</template>
