<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { absoluteAssetUrl, productJsonLd } from '~/utils/seo';
import { buildRelatedWatches } from '~/utils/similar-watches';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const RELATED_WATCHES_TOTAL = 18;

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

const { data: catalogPool, refresh: refreshCatalogPool } = await useCachedAsyncData<WatchPublicDto[]>(
  () => `product-related-pool-${slug.value}`,
  async () => {
    try {
      return (await catalog.listCatalog({ limit: 100, available: 'true' })).data;
    } catch {
      return [];
    }
  },
  { default: (): WatchPublicDto[] => [], staleTime: STOREFRONT_CACHE_MS.catalog },
);

const relatedWatches = computed(() => (
  watch.value ? buildRelatedWatches(watch.value, catalogPool.value ?? [], RELATED_WATCHES_TOTAL) : []
));

onMounted(() => {
  void refreshCatalogPool();
});

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

usePageSeo(() => {
  const item = watch.value;
  if (!item) return {};
  const name = `${item.brand.name} ${item.model}`.trim();
  const description = item.description?.trim()
    || `${item.brand.name} ${item.model}. ${item.movementType}. ${item.stock > 0 ? 'Disponible' : 'Agotado'}.`;
  const images = [watchPrimaryImage(item), watchSecondaryImage(item)].filter((url): url is string => Boolean(url));
  return {
    title: `${name} — LUXTIMEE`,
    description,
    image: images[0] ? absoluteAssetUrl(images[0]) : undefined,
    imageAlt: name,
    ogType: 'product' as const,
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Catálogo', path: '/catalogo' },
      { name, path: `/producto/${item.slug}` },
    ],
    jsonLd: [productJsonLd({
      name,
      description,
      sku: item.sku,
      brand: item.brand.name,
      slug: item.slug,
      price: item.retailPrice,
      availability: item.stock > 0 ? 'InStock' : 'OutOfStock',
      images,
    })],
  };
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
      v-if="relatedWatches.length"
      :key="`${watch.slug}-related`"
      class="product-related-carousel"
      :watches="relatedWatches"
      eyebrow="Descubre más"
      title="Relojes del catálogo"
      :cycle-seconds="28"
    />
  </div>
</template>
