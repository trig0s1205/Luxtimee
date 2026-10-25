<script setup lang="ts">
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['wholesale'] });

const route = useRoute();
const catalogApi = useCatalogData();
const cart = useWholesaleCartStore();
const analytics = useAnalytics();
const { catalog: offers } = useWholesaleQuote();

const slug = computed(() => String(route.params.slug));

const { data: watch, error } = await useAsyncData(
  'wholesale-product',
  () => catalogApi.getWholesaleBySlug(slug.value),
  { watch: [slug], server: false },
);

if (error.value) {
  throw createError({ statusCode: 404, message: 'Producto no encontrado' });
}

const displayPrice = computed(() => {
  const base = watch.value?.wholesalePrice ?? watch.value?.retailPrice ?? 0;
  const extras = offers.value?.extras ?? [];
  const extraTotal = extras.reduce((sum, extra) => sum + extra.price * (selected[extra.id] ?? 0), 0);
  return base + extraTotal;
});

const selected = reactive<Record<string, number>>({});

function onExtraChange(extra: { extraId: string; quantity: number }) {
  selected[extra.extraId] = extra.quantity;
}

function addToCart() {
  if (!watch.value) return;
  const picked = (offers.value?.extras ?? [])
    .filter((extra) => (selected[extra.id] ?? 0) > 0)
    .map((extra) => ({
      extraId: extra.id,
      name: extra.name,
      quantity: selected[extra.id] ?? 0,
    }));
  cart.addFromWatch(watch.value, 1, picked);
  analytics.track('add_to_cart', { slug: watch.value.slug, channel: 'wholesale' });
}

usePageSeo(() => ({
  title: watch.value ? `${watch.value.brand.name} ${watch.value.model} — Mayorista` : 'Catálogo mayorista — LUXTIMEE',
  description: 'Ficha privada del catálogo mayorista LUXTIMEE.',
  noindex: true,
}));
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
        <WholesaleExtraPicker
          class="mt-6"
          :extras="offers?.extras ?? []"
          :selected="Object.entries(selected).map(([extraId, quantity]) => ({ extraId, quantity }))"
          @change="onExtraChange"
        />

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
