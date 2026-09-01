<script setup lang="ts">
import type { PaginatedResponse, WatchPublicDto } from '@luxtime/shared';

definePageMeta({ middleware: ['wholesale'] });

const PAGE_SIZE = 24;

const catalog = useCatalogData();
const cart = useWholesaleCartStore();
const { session, logout, isAuthed, loaded } = useWholesaleSession();

async function onLogout() {
  await logout();
  await navigateTo('/mayoristas');
}

const searchInput = ref('');
const searchQuery = ref('');
const page = ref(1);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery.value = searchInput.value;
    page.value = 1;
  }, 300);
}

function clearSearch() {
  searchInput.value = '';
  searchQuery.value = '';
  page.value = 1;
}

const wholesaleKey = computed(() => `wholesale-catalog-${searchQuery.value}-${page.value}`);

const { data, pending, refresh, error } = await useAsyncData(
  wholesaleKey,
  () => catalog.listWholesaleCatalog({
    page: page.value,
    limit: PAGE_SIZE,
    sort: 'newest',
    available: 'true',
    search: searchQuery.value.trim() || undefined,
  }),
  { server: false, watch: [wholesaleKey] },
);

const watches = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

watch([loaded, isAuthed], ([ready, authed]) => {
  if (ready && authed) refresh();
});

onMounted(() => {
  cart.hydrate();
});

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value || next === page.value) return;
  page.value = next;
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

useSeoMeta({ title: 'Catálogo mayorista — LUXTIMEE' });
</script>

<template>
  <div class="mayoristas-page wholesale-catalog">
    <header class="wholesale-catalog__toolbar">
      <div class="wholesale-catalog__intro">
        <p class="manifesto-tag">Acceso privado</p>
        <div class="wholesale-catalog__title-row">
          <h1>Catálogo mayorista</h1>
          <button type="button" class="wholesale-catalog__logout" @click="onLogout">
            Cerrar acceso
          </button>
        </div>
        <p v-if="session" class="wholesale-catalog__session">
          {{ session.name }} · {{ session.email }}
        </p>
      </div>

      <div class="wholesale-catalog__meta">
        <span class="wholesale-chip">Mín. 4 unidades</span>
        <span class="wholesale-chip">Precios mayorista</span>
        <span v-if="!pending" class="wholesale-chip wholesale-chip--gold">{{ total }} relojes</span>
      </div>

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
    </header>

    <div v-if="pending" class="wholesale-catalog__status">Cargando catálogo...</div>
    <p v-else-if="error" class="wholesale-catalog__status">No se pudo cargar el catálogo. Intenta de nuevo.</p>

    <template v-else-if="watches.length">
      <div class="wholesale-catalog-grid">
        <CatalogWholesaleWatchCard
          v-for="watch in watches"
          :key="watch.id"
          :watch="watch"
          compact
        />
      </div>

      <nav v-if="totalPages > 1" class="wholesale-pagination" aria-label="Paginación del catálogo">
        <button
          type="button"
          class="wholesale-page-btn"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          Anterior
        </button>
        <span class="wholesale-page-info">
          Página {{ page }} de {{ totalPages }} · {{ total }} relojes
        </span>
        <button
          type="button"
          class="wholesale-page-btn"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          Siguiente
        </button>
      </nav>
    </template>

    <p v-else class="wholesale-catalog__status">No hay relojes disponibles.</p>
  </div>
</template>

<style scoped>
.wholesale-catalog {
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.wholesale-catalog__toolbar {
  display: grid;
  gap: 14px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.14);
}

.wholesale-catalog__intro {
  display: grid;
  gap: 6px;
}

.wholesale-catalog__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wholesale-catalog__title-row h1 {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.5vw, 34px);
  font-weight: 400;
  line-height: 1.1;
  color: var(--white);
}

.wholesale-catalog__session {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.wholesale-catalog__logout {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.wholesale-catalog__logout:hover {
  border-color: rgba(200, 169, 110, 0.45);
  color: var(--gold, #c8a96e);
}

.wholesale-catalog__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wholesale-chip {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
}

.wholesale-chip--gold {
  border-color: rgba(200, 169, 110, 0.35);
  color: var(--gold, #c8a96e);
}

.wholesale-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.wholesale-search-icon {
  position: absolute;
  left: 14px;
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

.wholesale-search-input {
  width: 100%;
  padding: 11px 40px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(200, 169, 110, 0.2);
  color: var(--white, #fff);
  font-family: var(--font-body);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.wholesale-search-input:focus {
  border-color: rgba(200, 169, 110, 0.45);
}

.wholesale-search-clear {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 18px;
  cursor: pointer;
}

.wholesale-catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.wholesale-catalog__status {
  padding: 28px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

.wholesale-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 16px;
  margin-top: 24px;
}

.wholesale-page-btn {
  padding: 10px 16px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: transparent;
  color: var(--gold, #c8a96e);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.wholesale-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wholesale-page-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

@media (min-width: 1024px) {
  .wholesale-catalog {
    padding: 24px 32px 56px;
  }

  .wholesale-catalog-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
  }
}

@media (max-width: 640px) {
  .wholesale-catalog__title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
