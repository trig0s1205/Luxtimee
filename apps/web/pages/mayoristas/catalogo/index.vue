<script setup lang="ts">
import type { PaginatedResponse, WatchPublicDto } from '@luxtime/shared';

definePageMeta({ middleware: ['wholesale'] });

const catalog = useCatalogData();
const cart = useWholesaleCartStore();
const { session, logout, isAuthed, loaded } = useWholesaleSession();

async function onLogout() {
  await logout();
  await navigateTo('/mayoristas');
}

const { data, pending, refresh, error } = await useAsyncData(
  'wholesale-catalog',
  () => catalog.listWholesaleCatalog({ limit: 30, sort: 'newest', available: 'true' }),
  { server: false },
);

const watches = computed(() => data.value?.data ?? []);

watch([loaded, isAuthed], ([ready, authed]) => {
  if (ready && authed) refresh();
});

useSeoMeta({ title: 'Catálogo mayorista — LUXTIMEE' });
</script>

<template>
  <div class="mayoristas-page px-6 md:px-16 py-12">
    <header class="flex flex-wrap items-start justify-between gap-4 mb-10">
      <div>
        <p class="manifesto-tag">Acceso privado</p>
        <h1 class="font-display text-3xl">Catálogo mayorista</h1>
        <p v-if="session" class="text-sm text-lux-white-dim mt-2">
          Bienvenido, {{ session.name }} · {{ session.email }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/mayoristas/carrito" class="btn-ghost">Carrito ({{ cart.unitCount }})</NuxtLink>
        <button type="button" class="btn-ghost" @click="onLogout">
          Cerrar acceso
        </button>
      </div>
    </header>

    <section class="mb-8 text-sm text-lux-white-dim leading-relaxed max-w-3xl">
      Precios mayoristas exclusivos para socios autorizados. Mínimo recomendado de compra: 4 unidades.
      Especificaciones completas por reloj. Los pedidos desde aquí se registran como mayorista.
    </section>

    <div v-if="pending" class="text-lux-white-dim">Cargando catálogo...</div>
    <p v-else-if="error" class="text-lux-white-dim">No se pudo cargar el catálogo. Intenta de nuevo.</p>

    <div v-else-if="watches.length" class="catalog-grid">
      <CatalogWholesaleWatchCard
        v-for="watch in watches"
        :key="watch.id"
        :watch="watch"
      />
    </div>

    <p v-else class="text-lux-white-dim">No hay relojes disponibles.</p>
  </div>
</template>
