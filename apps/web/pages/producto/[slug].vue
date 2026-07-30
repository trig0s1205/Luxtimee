<script setup lang="ts">
import { formatCop } from '~/utils/format';
import { buildRelatedWatches } from '~/utils/similar-watches';

const RELATED_WATCHES_TOTAL = 20;

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const { openChat } = useWhatsApp();
const analytics = useAnalytics();

const { data: watch, error } = await useAsyncData(
  'product-detail',
  () => catalog.getBySlug(slug.value),
  { watch: [slug] },
);
const { watchPrimaryImage, watchSecondaryImage, watchVideoUrl } = useMediaUrl();

const { data: catalogPool } = await useAsyncData(
  'product-related-pool',
  async () => (await catalog.listCatalog({ limit: 100, available: 'true' })).data,
  { default: () => [] },
);

const similarWatches = computed(() => (
  watch.value ? buildRelatedWatches(watch.value, catalogPool.value ?? [], RELATED_WATCHES_TOTAL) : []
));

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

watchEffect(() => {
  if (!watch.value) return;
  useSeoMeta({
    title: `${watch.value.brand.name} ${watch.value.model} — Luxtime`,
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

async function consultWhatsApp() {
  if (!watch.value) return;
  await openChat(`Me interesa: ${watch.value.brand.name} ${watch.value.model}`);
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
            <button type="button" class="btn-whatsapp" @click="consultWhatsApp">
              💬 Consultar por WhatsApp
            </button>
          </div>
        </div>

        <CatalogWatchTechSheet :watch="watch" inline compact />
      </div>
    </div>

    <CatalogSimilarWatchesCarousel :key="watch.slug" :watches="similarWatches" />
  </div>
</template>
