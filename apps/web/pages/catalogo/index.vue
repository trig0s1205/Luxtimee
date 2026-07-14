<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { WHOLESALE_BANNER } from '@luxtime/shared';

const catalog = useCatalogData();
const cart = useCartStore();
const analytics = useAnalytics();

const filters = ref<{ brand?: string; movement?: string; available?: string }>({});

const { data: brands } = await useAsyncData('catalog-brands', () => catalog.listBrands());

const { data: catalogResult, pending, refresh } = await useAsyncData(
  'catalog-list',
  () =>
    catalog.listCatalog({
      brand: filters.value.brand,
      movement: filters.value.movement,
      available: filters.value.available,
      limit: 50,
    }),
  { watch: [filters] },
);

useSeoMeta({
  title: 'Catálogo — Luxtime',
  description: 'Explora nuestra colección de relojes de lujo. Scroll inmersivo y filtros por marca y disponibilidad.',
});

function onAddToCart(watch: WatchPublicDto) {
  cart.addFromWatch(watch);
  analytics.track('add_to_cart', { slug: watch.slug });
}
</script>

<template>
  <div class="px-6 md:px-16 py-8">
    <UiSectionHeader label="Colección" title="Catálogo" />
    <p class="text-lux-white-dim text-sm max-w-2xl mb-6 -mt-6">
      Desliza para descubrir cada pieza. Experiencia inmersiva inspirada en redes sociales.
    </p>

    <div class="mb-6 p-4 border border-lux-gold/30 text-center text-xs uppercase tracking-widest text-lux-gold">
      {{ WHOLESALE_BANNER }}
    </div>

    <CatalogFilters
      v-if="brands"
      v-model="filters"
      :brands="brands"
      @update:model-value="refresh()"
    />

    <div v-if="pending" class="h-[60vh] flex items-center justify-center text-lux-white-dim text-sm uppercase tracking-widest">
      Cargando catálogo…
    </div>

    <CatalogTikTokFeed
      v-else-if="catalogResult?.data?.length"
      :watches="catalogResult.data"
      @select="onAddToCart"
    />

    <p v-else class="text-center text-lux-white-dim py-20">No hay relojes con estos filtros.</p>
  </div>
</template>
