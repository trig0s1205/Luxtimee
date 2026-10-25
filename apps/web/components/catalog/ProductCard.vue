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
const imageReady = ref(false);

watch(imageUrl, () => {
  imageReady.value = false;
});

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
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
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
  >
    <NuxtLink
      :to="`/producto/${watch.slug}`"
      class="products-card__link"
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
        class="media-reveal"
        :class="{ 'media-reveal--ready': imageReady }"
        loading="lazy"
        @load="imageReady = true"
      >
      <div v-else class="watch-placeholder" />
    </div>
    <div class="products-info">
      <p class="products-tag">{{ watch.brand.name }}</p>
      <h3 class="products-name">{{ watch.model }}</h3>
      <p class="products-ref">{{ watch.movementType }}</p>
      <div class="products-bottom">
        <p class="products-price">{{ formatCop(watch.retailPrice) }}</p>
        <span class="products-card__add-slot" aria-hidden="true" />
      </div>
    </div>
    </NuxtLink>
    <button type="button" class="add-btn products-card__add" :aria-label="t('product.add')" @click="onAdd">+</button>
  </article>
</template>

<style scoped>
.products-card__link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.products-card__add-slot {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
}

.products-card__add {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 2;
}
</style>
