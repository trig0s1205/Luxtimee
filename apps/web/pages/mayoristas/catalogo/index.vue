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

const searchInput = ref('');
const searchQuery = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery.value = searchInput.value;
  }, 300);
}

function clearSearch() {
  searchInput.value = '';
  searchQuery.value = '';
}

const wholesaleKey = computed(() => `wholesale-catalog-${searchQuery.value}`);

const { data, pending, refresh, error } = await useAsyncData(
  wholesaleKey,
  () => catalog.listWholesaleCatalog({
    limit: 60,
    sort: 'newest',
    available: 'true',
    search: searchQuery.value.trim() || undefined,
  }),
  { server: false, watch: [wholesaleKey] },
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
      Precios mayoristas exclusivos para clientes autorizados. Mínimo recomendado de compra: 4 unidades.
      Especificaciones completas por reloj. Los pedidos desde aquí se registran como mayorista.
    </section>

    <div class="wholesale-search-wrap">
      <svg class="wholesale-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
      <input
        v-model="searchInput"
        type="search"
        class="wholesale-search-input"
        placeholder="Buscar por marca, modelo o SKU..."
        @input="onSearchInput"
      >
      <button
        v-if="searchInput"
        type="button"
        class="wholesale-search-clear"
        aria-label="Limpiar búsqueda"
        @click="clearSearch"
      >
        ×
      </button>
    </div>

    <div v-if="pending" class="text-lux-white-dim mt-6">Cargando catálogo...</div>
    <p v-else-if="error" class="text-lux-white-dim mt-6">No se pudo cargar el catálogo. Intenta de nuevo.</p>

    <div v-else-if="watches.length" class="wholesale-catalog-grid mt-6">
      <CatalogWholesaleWatchCard
        v-for="watch in watches"
        :key="watch.id"
        :watch="watch"
      />
    </div>

    <p v-else class="text-lux-white-dim mt-6">No hay relojes disponibles.</p>
  </div>
</template>

<style scoped>
.wholesale-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 480px;
  margin-bottom: 8px;
}

.wholesale-search-icon {
  position: absolute;
  left: 14px;
  width: 16px;
  height: 16px;
  color: var(--white-dim, rgba(255,255,255,0.45));
  pointer-events: none;
  flex-shrink: 0;
}

.wholesale-search-input {
  width: 100%;
  padding: 12px 40px 12px 40px;
  background: transparent;
  border: 1px solid rgba(200, 169, 110, 0.2);
  color: var(--white, #fff);
  font-family: var(--font-body);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.wholesale-search-input::placeholder {
  color: var(--white-dim, rgba(255,255,255,0.45));
}

.wholesale-search-input:focus {
  border-color: rgba(200, 169, 110, 0.45);
}

.wholesale-catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 600px) {
  .wholesale-catalog-grid {
    grid-template-columns: 1fr;
  }
}

.wholesale-search-clear {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--white-dim, rgba(255,255,255,0.45));
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
</style>
