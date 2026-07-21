<script setup lang="ts">
import { formatCop } from '~/utils/format';

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const auth = useAuthStore();
const wishlist = useWishlistStore();
const api = useApi();
const analytics = useAnalytics();

const experienceItems = [
  'Caja Estuche Luxury',
  'Tarjeta Autenticidad PVC QR',
  'Paño microfibra',
  'Solución limpiadora',
  'Batería de repuesto',
];

onMounted(async () => {
  if (auth.isAuthenticated) await wishlist.fetch();
});

const { data: watch, error } = await useAsyncData(`product-${slug.value}`, () => catalog.getBySlug(slug.value));

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

watchEffect(() => {
  if (!watch.value) return;
  useSeoMeta({
    title: `${watch.value.brand.name} ${watch.value.model} — Luxtime`,
    description: `${watch.value.movementType}. ${watch.value.stock > 0 ? 'Disponible' : 'Agotado'}.`,
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
        :front-url="watch.frontImageUrl"
        :back-url="watch.backImageUrl"
        :alt="`${watch.brand.name} ${watch.model}`"
      />

      <div>
        <p class="products-tag">{{ watch.brand.name }}</p>
        <h1 class="detail-title">{{ watch.model }}</h1>
        <p class="detail-ref">{{ watch.movementType }} · Ref. {{ watch.slug }}</p>
        <p class="detail-price">{{ formatCop(watch.retailPrice) }}</p>

        <div v-if="Object.keys(watch.specs).length" class="grid grid-cols-2 gap-3 my-6">
          <div
            v-for="(value, key) in watch.specs"
            :key="key"
            class="border border-lux-gold/15 p-3"
          >
            <p class="text-[10px] uppercase tracking-widest text-lux-white-dim mb-1">{{ key }}</p>
            <p class="text-sm text-lux-white">{{ value }}</p>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn-add-to-cart" :disabled="watch.stock === 0" @click="addToCart">
            Agregar al carrito
          </button>
          <button type="button" class="btn-whatsapp" @click="consultWhatsApp">
            💬 Consultar por WhatsApp
          </button>
          <button
            v-if="auth.isAuthenticated"
            type="button"
            class="btn-ghost"
            @click="wishlist.toggle(watch.id)"
          >
            {{ wishlist.has(watch.id) ? '♥ En deseos' : '♡ Guardar' }}
          </button>
        </div>

        <div class="product-experience-block">
          <p class="detail-experience-title">Tu Experiencia Luxtime incluye:</p>
          <ul class="detail-experience">
            <li v-for="item in experienceItems" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div v-if="watch.warrantyTemplate" class="mt-6 border border-lux-gold/15 p-5">
          <p class="detail-experience-title">Garantía</p>
          <p class="text-sm text-lux-white-dim">{{ watch.warrantyTemplate.terms }}</p>
        </div>

        <div v-if="watch.careTemplate" class="mt-4 border border-lux-gold/15 p-5">
          <p class="detail-experience-title">Cuidados</p>
          <p class="text-sm text-lux-white-dim">{{ watch.careTemplate.instructions }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
