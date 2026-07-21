<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

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

const showLimited = computed(() => props.watch.stock > 0 && props.watch.stock <= 3);

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
    <span v-if="showLimited" class="badge-limited">{{ t('product.limited') }}</span>
    <div class="products-img">
      <img
        v-if="watch.frontImageUrl"
        :src="watch.frontImageUrl"
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
