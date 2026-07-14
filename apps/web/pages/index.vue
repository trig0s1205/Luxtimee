<script setup lang="ts">
import { mockWatches, wholesaleBanner } from '~/mocks/watches';
</script>

<template>
  <div>
    <section class="min-h-[85vh] flex flex-col items-center justify-center text-center px-6">
      <p class="lux-section-label">Alta relojería · Bucaramanga</p>
      <h1 class="font-display text-6xl md:text-8xl font-light leading-none mb-4">
        LUX<span class="text-lux-gold font-semibold">TIME</span>
      </h1>
      <p class="font-display italic text-xl text-lux-white-dim mb-10">El tiempo, en su forma más elegante</p>
      <div class="flex flex-wrap gap-4 justify-center">
        <UiLuxButton>Explorar catálogo</UiLuxButton>
        <UiLuxButton variant="ghost">Contactar por WhatsApp</UiLuxButton>
      </div>
    </section>

    <section class="px-6 md:px-16 py-6 border-y border-lux-gold/15 bg-lux-black-2 overflow-hidden">
      <div class="lux-marquee flex gap-16 whitespace-nowrap text-[11px] uppercase tracking-[0.3em] text-lux-white-dim">
        <span v-for="n in 8" :key="n" class="flex items-center gap-4">
          Envío nacional · Autenticidad garantizada · Atención personalizada
          <span class="w-1 h-1 rounded-full bg-lux-gold" />
        </span>
      </div>
    </section>

    <section class="px-6 md:px-16 py-20 bg-lux-black-2">
      <div class="mb-4 p-4 border border-lux-gold/30 text-center text-xs uppercase tracking-widest text-lux-gold">
        {{ wholesaleBanner }}
      </div>
      <UiSectionHeader label="Destacados" title="Colección premium" />
      <div class="grid md:grid-cols-3 gap-2">
        <UiWatchCard v-for="watch in mockWatches.slice(0, 3)" :key="watch.id" :watch="watch" />
      </div>
    </section>

    <section class="px-6 md:px-16 py-20">
      <UiSectionHeader label="Diseño" title="Revisa las 3 variantes" />
      <NuxtLink to="/design" class="inline-block">
        <UiLuxButton variant="ghost">Abrir showcase /design</UiLuxButton>
      </NuxtLink>
    </section>
  </div>
</template>
