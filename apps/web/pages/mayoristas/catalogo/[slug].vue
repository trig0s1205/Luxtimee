<script setup lang="ts">
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['wholesale'] });

const route = useRoute();
const catalog = useCatalogData();
const cart = useWholesaleCartStore();
const analytics = useAnalytics();

const slug = computed(() => String(route.params.slug));

const { data: watch, error } = await useAsyncData(
  'wholesale-product',
  () => catalog.getWholesaleBySlug(slug.value),
  { watch: [slug], server: false },
);

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

const displayPrice = computed(() => watch.value?.wholesalePrice ?? watch.value?.retailPrice ?? 0);

function addToCart() {
  if (!watch.value) return;
  cart.addFromWatch(watch.value);
  analytics.track('add_to_cart', { slug: watch.value.slug, channel: 'wholesale' });
}

useSeoMeta({
  title: watch.value ? `${watch.value.brand.name} ${watch.value.model} — Mayorista` : 'Mayorista',
});
</script>

<template>
  <div v-if="watch" class="mayoristas-page px-6 md:px-16 py-12 max-w-5xl mx-auto">
    <NuxtLink to="/mayoristas/catalogo" class="text-sm text-lux-gold">← Volver al catálogo mayorista</NuxtLink>

    <div class="grid md:grid-cols-2 gap-10 mt-8">
      <img
        v-if="watch.frontImageUrl"
        :src="watch.frontImageUrl"
        :alt="watch.model"
        class="w-full aspect-square object-contain bg-lux-black-3 border border-lux-gold/15"
      >

      <div>
        <p class="text-xs uppercase tracking-widest text-lux-white-dim">{{ watch.brand.name }}</p>
        <h1 class="font-display text-4xl mt-2">{{ watch.model }}</h1>
        <p class="text-sm text-lux-white-dim mt-2">{{ watch.movementType }} · Ref. {{ watch.reference || watch.slug }}</p>
        <p class="text-lux-gold font-display text-3xl mt-6">{{ formatCop(displayPrice) }}</p>
        <p class="text-xs text-lux-white-dim mt-2">Precio mayorista · Stock {{ watch.stock }}</p>

        <button type="button" class="btn-primary mt-8" :disabled="watch.stock === 0" @click="addToCart">
          Agregar al carrito mayorista
        </button>
      </div>
    </div>

    <section v-if="watch.description" class="mt-12 text-lux-white-dim leading-relaxed">
      <h2 class="font-display text-2xl text-lux-white mb-4">Descripción</h2>
      <p>{{ watch.description }}</p>
    </section>
  </div>
</template>
