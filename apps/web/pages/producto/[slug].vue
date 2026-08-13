<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { buildRelatedWatches, pickRandomWatches } from '~/utils/similar-watches';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const RELATED_WATCHES_TOTAL = 16;
const RANDOM_WATCHES_TOTAL = 14;

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const analytics = useAnalytics();
const { watchPrimaryImage, watchSecondaryImage, watchVideoUrl } = useMediaUrl();

const { data: watch, error } = await useCachedAsyncData(
  () => `product-detail-${slug.value}`,
  () => catalog.getBySlug(slug.value),
  { watch: [slug], staleTime: STOREFRONT_CACHE_MS.product },
);

const { data: catalogPool } = await useCachedAsyncData<WatchPublicDto[]>(
  'product-related-pool',
  async () => (await catalog.listCatalog({ limit: 100, available: 'true' })).data,
  { default: (): WatchPublicDto[] => [], staleTime: STOREFRONT_CACHE_MS.catalog },
);

const similarWatches = computed(() => (
  watch.value ? buildRelatedWatches(watch.value, catalogPool.value ?? [], RELATED_WATCHES_TOTAL) : []
));

const randomWatches = computed(() => (
  watch.value ? pickRandomWatches(watch.value, catalogPool.value ?? [], RANDOM_WATCHES_TOTAL, watch.value.slug) : []
));

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

watchEffect(() => {
  if (!watch.value) return;
  useSeoMeta({
    title: `${watch.value.brand.name} ${watch.value.model} — LUXTIMEE`,
    description: watch.value.description?.trim()
      || `${watch.value.movementType}. ${watch.value.stock > 0 ? 'Disponible' : 'Agotado'}.`,
    ogImage: watch.value.frontImageUrl ?? undefined,
  });
});

function addToCart() {
  if (!watch.value) return;
  cart.addFromWatch(watch.value);
  analytics.track('add_to_cart', { slug: watch.value.slug });
}
</script>

<template>
  <div v-if="watch" class="product-page">
    <div class="product-page-grid">
      <div class="product-gallery-col">
        <CatalogProductGallery
          :front-url="watchPrimaryImage(watch)"
          :back-url="watchSecondaryImage(watch)"
          :video-url="watchVideoUrl(watch)"
          :alt="`${watch.brand.name} ${watch.model}`"
        />
      </div>

      <div class="product-info-col">
        <div class="product-info-head">
          <p class="products-tag">{{ watch.brand.name }}</p>
          <h1 class="detail-title product-detail-title">{{ watch.model }}</h1>
          <p class="detail-ref">{{ watch.movementType }} · Ref. {{ watch.reference || watch.slug }}</p>
          <p class="detail-price product-detail-price">{{ formatCop(watch.retailPrice) }}</p>

          <div class="detail-actions">
            <button type="button" class="btn-add-to-cart" :disabled="watch.stock === 0" @click="addToCart">
              Agregar al carrito
            </button>
          </div>
        </div>

        <CatalogWatchTechSheet :watch="watch" inline compact />
      </div>
    </div>

    <CatalogSimilarWatchesCarousel
      :key="`${watch.slug}-similar`"
      :watches="similarWatches"
      eyebrow="Selección curada"
      title="Relojes que combinan con tu gusto"
    />

    <CatalogSimilarWatchesCarousel
      v-if="randomWatches.length"
      :key="`${watch.slug}-random`"
      :watches="randomWatches"
      eyebrow="Explora más"
      title="Piezas que podrían interesarte"
    />
  </div>
</template>
