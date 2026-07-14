<script setup lang="ts">
import { mockWatches, wholesaleBanner, formatCop } from '~/mocks/watches';

const route = useRoute();
const variant = computed(() => String(route.params.variant || 'onyx'));

const variantClass = computed(() => {
  if (variant.value === 'editorial') return 'variant-editorial';
  if (variant.value === 'midnight') return 'variant-midnight';
  return 'variant-onyx';
});

const screens = ['home', 'catalog', 'product', 'checkout', 'account', 'admin'] as const;
const activeScreen = ref<(typeof screens)[number]>('home');
const selectedWatch = ref(mockWatches[0]);
</script>

<template>
  <div :class="['variant-shell', variantClass]">
    <header class="sticky top-0 z-50 border-b border-[color:var(--v-accent)]/20 backdrop-blur px-6 py-4 flex flex-wrap gap-4 items-center justify-between" style="background: color-mix(in srgb, var(--v-bg) 92%, transparent)">
      <div>
        <p class="text-xs uppercase tracking-lux" style="color: var(--v-accent)">Luxtime Design Lab</p>
        <h1 class="font-display text-3xl capitalize">{{ variant.replace('-', ' ') }}</h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="screen in screens"
          :key="screen"
          type="button"
          class="px-3 py-2 text-[10px] uppercase tracking-widest border"
          :style="{
            borderColor: activeScreen === screen ? 'var(--v-accent)' : 'color-mix(in srgb, var(--v-text) 20%, transparent)',
            background: activeScreen === screen ? 'var(--v-accent)' : 'transparent',
            color: activeScreen === screen ? 'var(--v-accent-contrast)' : 'var(--v-text-dim)',
          }"
          @click="activeScreen = screen"
        >
          {{ screen }}
        </button>
        <NuxtLink to="/design" class="px-3 py-2 text-[10px] uppercase tracking-widest border" style="border-color: var(--v-accent); color: var(--v-accent)">
          Volver
        </NuxtLink>
      </div>
    </header>

    <main class="p-6 md:p-12 space-y-10">
      <section v-if="activeScreen === 'home'" class="space-y-10">
        <div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
          <p class="text-[10px] uppercase tracking-[0.4em] mb-6" style="color: var(--v-accent)">Alta relojería</p>
          <h2 class="font-display text-6xl md:text-8xl font-light leading-none mb-4">LUX<span style="color: var(--v-accent)">TIME</span></h2>
          <p class="italic font-display text-xl" style="color: var(--v-text-dim)">El tiempo, en su forma más elegante</p>
          <div class="mt-10 flex gap-4">
            <button class="px-8 py-4 text-xs uppercase tracking-lux font-semibold" style="background: var(--v-accent); color: var(--v-accent-contrast)">Explorar catálogo</button>
            <button class="px-8 py-4 text-xs uppercase tracking-lux border" style="border-color: color-mix(in srgb, var(--v-text) 25%, transparent)">WhatsApp</button>
          </div>
        </div>
        <div class="p-4 border text-center text-sm uppercase tracking-widest" style="border-color: var(--v-accent); color: var(--v-accent)">
          {{ wholesaleBanner }}
        </div>
        <div class="grid md:grid-cols-3 gap-4">
          <article v-for="watch in mockWatches.slice(0, 3)" :key="watch.id" class="border p-4" style="border-color: color-mix(in srgb, var(--v-accent) 20%, transparent); background: var(--v-bg-2)">
            <img :src="watch.image" :alt="watch.model" class="h-48 w-full object-contain mb-4" />
            <p class="text-xs uppercase tracking-lux" style="color: var(--v-accent)">{{ watch.brand }}</p>
            <h3 class="font-display text-2xl">{{ watch.model }}</h3>
          </article>
        </div>
      </section>

      <section v-else-if="activeScreen === 'catalog'" class="h-[80vh] overflow-y-auto snap-y snap-mandatory rounded border" style="border-color: color-mix(in srgb, var(--v-accent) 20%, transparent)">
        <article
          v-for="watch in mockWatches"
          :key="watch.id"
          class="snap-start min-h-[80vh] flex flex-col md:flex-row items-center justify-center gap-10 p-8"
          style="background: var(--v-bg-2)"
          @click="selectedWatch = watch"
        >
          <img :src="watch.image" :alt="watch.model" class="max-h-[50vh] object-contain" />
          <div>
            <p class="text-xs uppercase tracking-lux mb-2" style="color: var(--v-accent)">{{ watch.brand }}</p>
            <h3 class="font-display text-5xl mb-4">{{ watch.model }}</h3>
            <p class="text-3xl font-display mb-6" style="color: var(--v-accent)">{{ formatCop(watch.retailPrice) }}</p>
            <button class="px-8 py-4 text-xs uppercase tracking-lux" style="background: var(--v-accent); color: var(--v-accent-contrast)">Ver ficha</button>
          </div>
        </article>
      </section>

      <section v-else-if="activeScreen === 'product'" class="grid lg:grid-cols-2 gap-10">
        <img :src="selectedWatch.image" :alt="selectedWatch.model" class="w-full max-h-[70vh] object-contain" style="background: var(--v-bg-2)" />
        <div class="space-y-6">
          <p class="text-xs uppercase tracking-lux" style="color: var(--v-accent)">{{ selectedWatch.brand }}</p>
          <h2 class="font-display text-5xl">{{ selectedWatch.model }}</h2>
          <p style="color: var(--v-text-dim)">{{ selectedWatch.movementType }} · {{ selectedWatch.stock > 0 ? 'Disponible' : 'Agotado' }}</p>
          <p class="text-3xl font-display" style="color: var(--v-accent)">{{ formatCop(selectedWatch.retailPrice) }}</p>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div v-for="(value, key) in selectedWatch.specs" :key="key" class="border p-3" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">
              <p class="uppercase text-[10px] tracking-widest" style="color: var(--v-text-dim)">{{ key }}</p>
              <p>{{ value }}</p>
            </div>
          </div>
          <div class="border p-4" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">
            <p class="text-xs uppercase tracking-lux mb-2" style="color: var(--v-accent)">Garantía</p>
            <p class="text-sm">{{ selectedWatch.warranty }}</p>
          </div>
        </div>
      </section>

      <section v-else-if="activeScreen === 'checkout'" class="max-w-2xl mx-auto space-y-6">
        <h2 class="font-display text-4xl">Checkout de intención</h2>
        <input class="w-full bg-transparent border px-4 py-3" style="border-color: color-mix(in srgb, var(--v-accent) 25%, transparent)" placeholder="Nombre completo" />
        <input class="w-full bg-transparent border px-4 py-3" style="border-color: color-mix(in srgb, var(--v-accent) 25%, transparent)" placeholder="Dirección" />
        <input class="w-full bg-transparent border px-4 py-3" style="border-color: color-mix(in srgb, var(--v-accent) 25%, transparent)" placeholder="Correo electrónico" />
        <label class="flex items-start gap-3 text-sm" style="color: var(--v-text-dim)">
          <input type="checkbox" class="mt-1" />
          Acepto Términos y Condiciones y la Política de Tratamiento de Datos.
        </label>
        <button class="w-full py-4 text-xs uppercase tracking-lux font-semibold" style="background: var(--v-accent); color: var(--v-accent-contrast)">Comprar por WhatsApp</button>
      </section>

      <section v-else-if="activeScreen === 'account'" class="max-w-3xl mx-auto space-y-6">
        <h2 class="font-display text-4xl">Mi cuenta</h2>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="border p-6" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">Historial de pedidos</div>
          <div class="border p-6" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">Garantías digitales</div>
          <div class="border p-6" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">Lista de deseos</div>
          <div class="border p-6" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">Datos de envío</div>
        </div>
      </section>

      <section v-else class="grid lg:grid-cols-[240px_1fr] gap-0 border min-h-[60vh]" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent)">
        <aside class="p-6 border-r" style="border-color: color-mix(in srgb, var(--v-accent) 15%, transparent); background: var(--v-bg-2)">
          <p class="font-display text-2xl mb-6" style="color: var(--v-accent)">Admin</p>
          <ul class="space-y-3 text-sm" style="color: var(--v-text-dim)">
            <li>Inventario</li>
            <li>Pre-pedidos (3)</li>
            <li>Pedidos</li>
          </ul>
        </aside>
        <div class="p-8">
          <h2 class="font-display text-3xl mb-4">Panel administrativo</h2>
          <p style="color: var(--v-text-dim)">Esqueleto visual del backoffice para la variante seleccionada.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
@import '~/assets/css/variants.css';
</style>
