<script setup lang="ts">
import { formatCop } from '~/utils/format';

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const catalog = useCatalogData();
const cart = useCartStore();
const auth = useAuthStore();
const wishlist = useWishlistStore();
const analytics = useAnalytics();

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

const jsonLd = computed(() => {
  if (!watch.value) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${watch.value.brand.name} ${watch.value.model}`,
    brand: watch.value.brand.name,
    offers: {
      '@type': 'Offer',
      price: watch.value.retailPrice,
      priceCurrency: 'COP',
      availability: watch.value.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
});

useHead({
  script: computed(() =>
    jsonLd.value
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }]
      : [],
  ),
});

function addToCart() {
  if (!watch.value) return;
  cart.addFromWatch(watch.value);
  analytics.track('add_to_cart', { slug: watch.value.slug });
}
</script>

<template>
  <div v-if="watch" class="px-6 md:px-16 py-12">
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-16">
      <CatalogProductGallery
        :front-url="watch.frontImageUrl"
        :back-url="watch.backImageUrl"
        :alt="`${watch.brand.name} ${watch.model}`"
      />

      <div class="space-y-6">
        <div>
          <p class="text-[10px] uppercase tracking-[0.35em] text-lux-gold mb-2">{{ watch.brand.name }}</p>
          <h1 class="font-display text-4xl md:text-5xl text-lux-white mb-3">{{ watch.model }}</h1>
          <p class="text-sm text-lux-white-dim">
            {{ watch.movementType }} ·
            <UiLuxBadge :tone="watch.stock > 0 ? 'gold' : 'detal'">
              {{ watch.stock > 0 ? 'Disponible' : 'Agotado' }}
            </UiLuxBadge>
          </p>
        </div>

        <p class="font-display text-3xl text-lux-gold">{{ formatCop(watch.retailPrice) }}</p>

        <div v-if="Object.keys(watch.specs).length" class="grid grid-cols-2 gap-3">
          <div
            v-for="(value, key) in watch.specs"
            :key="key"
            class="border border-lux-gold/15 p-3"
          >
            <p class="text-[10px] uppercase tracking-widest text-lux-white-dim mb-1">{{ key }}</p>
            <p class="text-sm text-lux-white">{{ value }}</p>
          </div>
        </div>

        <div v-if="watch.warrantyTemplate" class="border border-lux-gold/15 p-5">
          <p class="text-[10px] uppercase tracking-widest text-lux-gold mb-2">Garantía</p>
          <p class="text-sm text-lux-white-dim">{{ watch.warrantyTemplate.terms }}</p>
        </div>

        <div v-if="watch.careTemplate" class="border border-lux-gold/15 p-5">
          <p class="text-[10px] uppercase tracking-widest text-lux-gold mb-2">Cuidados</p>
          <p class="text-sm text-lux-white-dim">{{ watch.careTemplate.instructions }}</p>
        </div>

        <div class="flex flex-wrap gap-4 pt-4">
          <UiLuxButton :disabled="watch.stock === 0" @click="addToCart">Añadir al carrito</UiLuxButton>
          <UiLuxButton v-if="auth.isAuthenticated" variant="ghost" @click="wishlist.toggle(watch.id)">
            {{ wishlist.has(watch.id) ? '♥ En deseos' : '♡ Guardar' }}
          </UiLuxButton>
          <NuxtLink to="/carrito">
            <UiLuxButton variant="ghost">Ver carrito</UiLuxButton>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
