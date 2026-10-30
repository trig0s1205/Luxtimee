<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { watch as watchRef } from 'vue';
import { formatCop } from '~/utils/format';
import { absoluteAssetUrl, productJsonLd } from '~/utils/seo';
import { buildRelatedWatches } from '~/utils/similar-watches';
import { buildProductWhatsappMessage } from '~/utils/product-whatsapp';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const RELATED_WATCHES_TOTAL = 18;

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const analytics = useAnalytics();
const { t } = useLocale();
const { openChat, loadSettings } = useWhatsApp();
const { watchPrimaryImage, watchSecondaryImage, watchVideoUrl } = useMediaUrl();

const { data: watch, error, pending, refresh } = await useCachedAsyncData(
  () => `product-detail-${slug.value}`,
  () => catalog.getBySlug(slug.value),
  { watch: [slug], lazy: import.meta.client, staleTime: STOREFRONT_CACHE_MS.product },
);

const { data: catalogPool, pending: relatedPending, refresh: refreshCatalogPool } = await useCachedAsyncData<WatchPublicDto[]>(
  () => `product-related-pool-${slug.value}`,
  async () => {
    try {
      return (await catalog.listCatalog({ limit: 100, available: 'true' })).data;
    } catch {
      return [];
    }
  },
  { lazy: true, server: false, default: (): WatchPublicDto[] => [], staleTime: STOREFRONT_CACHE_MS.catalog },
);

const relatedWatches = computed(() => (
  watch.value ? buildRelatedWatches(watch.value, catalogPool.value ?? [], RELATED_WATCHES_TOTAL) : []
));

onMounted(() => {
  void loadSettings();
  if (watch.value) void refresh();
  void refreshCatalogPool();
});

if (import.meta.server && error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

if (import.meta.client) {
  watchRef(error, (value) => {
    if (value) showError({ statusCode: 404, statusMessage: 'Producto no encontrado' });
  });
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

function buyOnWhatsApp() {
  if (!watch.value) return;
  void openChat(buildProductWhatsappMessage({
    brand: watch.value.brand.name,
    model: watch.value.model,
    sku: watch.value.sku,
  }));
}
</script>

<template>
  <div v-if="pending && !watch" class="product-page" aria-busy="true">
    <div class="product-page-grid">
      <div class="product-gallery-col">
        <div class="product-skeleton product-skeleton--gallery" />
      </div>
      <div class="product-info-col product-skeleton-copy">
        <div class="product-skeleton product-skeleton--line" />
        <div class="product-skeleton product-skeleton--title" />
        <div class="product-skeleton product-skeleton--price" />
      </div>
    </div>
  </div>
  <div v-else-if="watch" class="product-page">
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
          <p
            v-if="watch.stock > 0"
            class="product-stock-note"
          >
            {{ t('product.stockExact').replace('{n}', String(watch.stock)) }}
          </p>
          <p v-else class="product-stock-note product-stock-note--out">{{ t('product.soldOut') }}</p>

          <div class="detail-actions">
            <button type="button" class="btn-add-to-cart" :disabled="watch.stock === 0" @click="addToCart">
              Agregar al carrito
            </button>
            <button type="button" class="btn-whatsapp" @click="buyOnWhatsApp">
              {{ t('product.whatsapp') }}
            </button>
          </div>
        </div>

        <CatalogWatchTechSheet :watch="watch" inline compact />
      </div>
    </div>

    <ClientOnly>
      <div>
        <div
          v-if="relatedPending && !relatedWatches.length"
          class="product-related-skeleton"
          aria-hidden="true"
        >
          <div v-for="i in 4" :key="i" class="product-skeleton product-skeleton--card" />
        </div>
        <CatalogSimilarWatchesCarousel
          v-else-if="relatedWatches.length"
          :key="`${watch.slug}-related`"
          class="product-related-carousel"
          :watches="relatedWatches"
          eyebrow="Descubre más"
          title="Relojes del catálogo"
          :cycle-seconds="28"
        />
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.product-skeleton {
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.09) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: product-shimmer 1.2s ease-in-out infinite;
}

.product-skeleton--gallery {
  width: 100%;
  aspect-ratio: 1;
}

.product-skeleton-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 12px;
}

.product-skeleton--line {
  width: 28%;
  height: 12px;
}

.product-skeleton--title {
  width: 72%;
  height: 36px;
}

.product-skeleton--price {
  width: 40%;
  height: 28px;
}

.product-related-skeleton {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 48px;
}

.product-skeleton--card {
  aspect-ratio: 3 / 4;
}

@keyframes product-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
  .product-related-skeleton {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
