<script setup lang="ts">
import { formatCop } from '~/utils/format';

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const api = useApi();
const analytics = useAnalytics();

const { data: watch, error } = await useAsyncData(`product-${slug.value}`, () => catalog.getBySlug(slug.value));
const { watchPrimaryImage, watchSecondaryImage, watchVideoUrl } = useMediaUrl();

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
  try {
    const s = await api.get<{ url: string; messagePrefix: string }>('/settings/whatsapp/public');
    const text = `${s.messagePrefix || ''} Me interesa: ${watch.value.brand.name} ${watch.value.model}`.trim();
    const sep = s.url.includes('?') ? '&' : '?';
    window.open(`${s.url}${sep}text=${encodeURIComponent(text)}`, '_blank');
  } catch { /* */ }
}

</script>

<template>
  <div v-if="watch" class="product-page">
    <div class="product-page-grid">
      <CatalogProductGallery
        :front-url="watchPrimaryImage(watch)"
        :back-url="watchSecondaryImage(watch)"
        :video-url="watchVideoUrl(watch)"
        :alt="`${watch.brand.name} ${watch.model}`"
      />

      <div class="product-info-col">
        <p class="products-tag">{{ watch.brand.name }}</p>
        <h1 class="detail-title">{{ watch.model }}</h1>
        <p class="detail-ref">{{ watch.movementType }} · Ref. {{ watch.reference || watch.slug }}</p>
        <p class="detail-price">{{ formatCop(watch.retailPrice) }}</p>

        <div class="detail-actions">
          <button type="button" class="btn-add-to-cart" :disabled="watch.stock === 0" @click="addToCart">
            Agregar al carrito
          </button>
          <button type="button" class="btn-whatsapp" @click="consultWhatsApp">
            💬 Consultar por WhatsApp
          </button>
        </div>

        <CatalogWatchTechSheet :watch="watch" inline />
      </div>
    </div>
  </div>
</template>
