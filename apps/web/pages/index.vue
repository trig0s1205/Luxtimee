<script setup lang="ts">
import { WHOLESALE_BANNER } from '@luxtime/shared';

const catalog = useCatalogData();
const { reveal } = useReveal();
const heroRef = ref<HTMLElement | null>(null);
const featuredRef = ref<HTMLElement | null>(null);

const { data: newArrivals } = await useAsyncData('home-new-arrivals', () => catalog.getNewArrivals());
const { data: bestSellers } = await useAsyncData('home-best-sellers', () => catalog.getBestSellers());

useSeoMeta({
  title: 'Luxtime — Relojes de lujo en Bucaramanga',
  description: 'Alta relojería con autenticidad garantizada. Envío nacional y atención personalizada.',
  ogTitle: 'Luxtime — Relojes de lujo',
  ogDescription: 'El tiempo, en su forma más elegante.',
});

onMounted(() => {
  reveal(heroRef.value);
  reveal(featuredRef.value);
});
</script>

<template>
  <div>
    <section ref="heroRef" class="min-h-[85vh] flex flex-col items-center justify-center text-center px-6">
      <p class="lux-section-label">Alta relojería · Bucaramanga</p>
      <h1 class="font-display text-6xl md:text-8xl font-light leading-none mb-4">
        LUX<span class="text-lux-gold font-semibold">TIME</span>
      </h1>
      <p class="font-display italic text-xl text-lux-white-dim mb-10">El tiempo, en su forma más elegante</p>
      <div class="flex flex-wrap gap-4 justify-center">
        <NuxtLink to="/catalogo">
          <UiLuxButton>Explorar catálogo</UiLuxButton>
        </NuxtLink>
        <UiLuxButton variant="ghost">Contactar por WhatsApp</UiLuxButton>
      </div>
    </section>

    <section class="px-6 md:px-16 py-6">
      <UiMarquee :items="['Envío nacional', 'Autenticidad garantizada', 'Atención personalizada']" />
    </section>

    <section ref="featuredRef" class="px-6 md:px-16 py-20 bg-lux-black-2">
      <div class="mb-4 p-4 border border-lux-gold/30 text-center text-xs uppercase tracking-widest text-lux-gold">
        {{ WHOLESALE_BANNER }}
      </div>
      <UiSectionHeader label="Novedades" title="Recién llegados" />
      <CatalogFeaturedCarousel v-if="newArrivals?.length" :watches="newArrivals" />
    </section>

    <section class="px-6 md:px-16 py-20">
      <UiSectionHeader label="Destacados" title="Más vendidos" />
      <CatalogFeaturedCarousel v-if="bestSellers?.length" :watches="bestSellers" />
    </section>
  </div>
</template>
