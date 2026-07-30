<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = defineProps<{
  watch: WatchPublicDto;
}>();

const { watchPrimaryImage } = useMediaUrl();

const imageUrl = computed(() => watchPrimaryImage(props.watch));

function displayPrice(watch: WatchPublicDto) {
  return watch.wholesalePrice ?? watch.retailPrice;
}
</script>

<template>
  <NuxtLink :to="`/mayoristas/catalogo/${watch.slug}`" class="products-card wholesale-card">
    <div class="products-img">
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
      <p class="products-ref">{{ watch.movementType }} · Stock {{ watch.stock }}</p>
      <div class="products-bottom">
        <p class="products-price">{{ formatCop(displayPrice(watch)) }}</p>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.wholesale-card {
  display: block;
  text-decoration: none;
  color: inherit;
}
</style>
