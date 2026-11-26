<script setup lang="ts">
import type { PosCatalogFacetsDto, PosCatalogPageDto, PosCatalogWatchDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { catalogPageList, hasActiveCatalogFilters, safeCatalogItems } from '~/utils/pos-catalog';

const props = defineProps<{
  cartQtyById: Record<string, number>;
  paused?: boolean;
}>();

const emit = defineEmits<{
  add: [watch: PosCatalogWatchDto];
  previewClosed: [];
  refreshed: [items: PosCatalogWatchDto[]];
}>();

const PAGE_SIZE = 30;

const api = useApi();
const toast = useToast();

const loading = ref(false);
const silentBusy = ref(false);
const loadError = ref<string | null>(null);
const items = ref<PosCatalogWatchDto[]>([]);
const total = ref(0);
const page = ref(1);
const galleryWatch = ref<PosCatalogWatchDto | null>(null);
const search = ref('');
const brand = ref('');
const onlyInStock = ref(true);
const brands = ref<PosCatalogFacetsDto['brands']>([]);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let abort: AbortController | null = null;
let catalogGeneration = 0;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const pageButtons = computed(() => catalogPageList(page.value, totalPages.value));
const rangeStart = computed(() => (total.value ? (page.value - 1) * PAGE_SIZE + 1 : 0));
const rangeEnd = computed(() => Math.min(total.value, page.value * PAGE_SIZE));
const searchActive = computed(() =>
  hasActiveCatalogFilters([search.value, brand.value, onlyInStock.value ? '' : 'todos']),
);

function buildQuery(nextPage: number) {
  return {
    page: nextPage,
    limit: PAGE_SIZE,
    search: search.value.trim() || undefined,
    brand: brand.value || undefined,
    inStock: onlyInStock.value ? 'true' : 'false',
  };
}

async function loadFacets() {
  try {
    const data = await api.get<PosCatalogFacetsDto>('/pos/catalog/facets');
    brands.value = data.brands ?? [];
  } catch {
    brands.value = [];
  }
}

async function loadPage(nextPage: number, opts?: { silent?: boolean }) {
  catalogGeneration += 1;
  const generation = catalogGeneration;
  abort?.abort();
  abort = new AbortController();
  if (!opts?.silent) {
    loading.value = true;
    loadError.value = null;
  } else {
    silentBusy.value = true;
  }
  try {
    const data = await api.get<PosCatalogPageDto>(
      '/pos/catalog',
      buildQuery(nextPage),
      { signal: abort.signal },
    );
    if (generation !== catalogGeneration) return;
    const list = safeCatalogItems<PosCatalogWatchDto>(data);
    page.value = Number(data?.page) || nextPage;
    total.value = Number(data?.total) || 0;
    items.value = list;
    if (opts?.silent) emit('refreshed', list);
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') return;
    if (opts?.silent) return;
    const message = extractApiErrorMessage(err, 'No se pudo cargar el catálogo.');
    loadError.value = message;
    items.value = [];
    toast.error(message);
  } finally {
    loading.value = false;
    silentBusy.value = false;
  }
}

async function reload() {
  page.value = 1;
  await loadPage(1);
}

async function goTo(next: number) {
  if (next < 1 || next > totalPages.value || next === page.value || loading.value) return;
  await loadPage(next);
}

let silentFlight: Promise<void> | null = null;

async function reloadSilent() {
  if (props.paused || document.hidden) return;
  if (silentFlight) return silentFlight;
  if (loading.value) return;
  silentFlight = loadPage(page.value, { silent: true }).finally(() => {
    silentFlight = null;
  });
  return silentFlight;
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void reload();
  }, 300);
}

function onBrandChange() {
  void reload();
}

function onStockToggle() {
  void reload();
}

function cartQty(id: string) {
  return props.cartQtyById[id] ?? 0;
}

function closeGallery() {
  galleryWatch.value = null;
  emit('previewClosed');
}

defineExpose({
  reload,
  reloadSilent,
  previewOpen: galleryWatch,
});

onMounted(() => {
  void loadFacets();
  void loadPage(1);
});

onBeforeUnmount(() => {
  abort?.abort();
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="pos-catalog">
    <div class="pos-catalog__toolbar">
      <input
        v-model="search"
        class="admin-input"
        type="search"
        placeholder="Buscar por marca, modelo o SKU…"
        aria-label="Buscar por marca, modelo o SKU"
        @input="onSearchInput"
        @keydown.enter.prevent="reload"
      >
      <label class="pos-catalog__brand">
        <span>Marca</span>
        <select v-model="brand" class="admin-input" @change="onBrandChange">
          <option value="">Todas</option>
          <option v-for="item in brands" :key="item.slug" :value="item.slug">
            {{ item.name }}
          </option>
        </select>
      </label>
      <label class="pos-catalog__stock">
        <input v-model="onlyInStock" type="checkbox" @change="onStockToggle">
        Solo con stock
      </label>
      <button
        type="button"
        class="admin-record-btn admin-record-btn--ghost"
        :disabled="silentBusy || loading"
        @click="reloadSilent()"
      >
        {{ silentBusy ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </div>

    <p v-if="!loading && !loadError" class="admin-record-muted">
      Mostrando {{ rangeStart }}–{{ rangeEnd }} de {{ total }} relojes
    </p>

    <div v-if="loading && !items.length" class="pos-catalog__state">
      <p class="admin-record-muted">Cargando catálogo…</p>
      <div class="pos-catalog__grid">
        <div v-for="n in 8" :key="n" class="pos-catalog__skeleton" />
      </div>
    </div>

    <div v-else-if="loadError" class="pos-catalog__state admin-record-empty">
      <p>{{ loadError }}</p>
      <button type="button" class="admin-record-btn admin-record-btn--primary" @click="reload">
        Reintentar
      </button>
    </div>

    <div v-else-if="!items.length" class="pos-catalog__state admin-record-empty">
      <p>No hay relojes{{ searchActive ? ' con estos filtros' : '' }}.</p>
    </div>

    <div v-else class="pos-catalog__grid">
      <AdminPosWatchCard
        v-for="watch in items"
        :key="watch.id"
        :watch="watch"
        :cart-qty="cartQty(watch.id)"
        @add="emit('add', watch)"
        @open-gallery="galleryWatch = watch"
      />
    </div>

    <nav v-if="totalPages > 1" class="pos-catalog__pages" aria-label="Páginas del catálogo">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1 || loading" @click="goTo(page - 1)">
        Anterior
      </button>
      <button
        v-for="(entry, idx) in pageButtons"
        :key="`${entry}-${idx}`"
        type="button"
        class="admin-records-page-btn"
        :disabled="entry === '…' || entry === page"
        :aria-current="entry === page ? 'page' : undefined"
        @click="typeof entry === 'number' && goTo(entry)"
      >
        {{ entry }}
      </button>
      <button
        type="button"
        class="admin-records-page-btn"
        :disabled="page >= totalPages || loading"
        @click="goTo(page + 1)"
      >
        Siguiente
      </button>
    </nav>

    <AdminPosGalleryModal
      v-if="galleryWatch"
      :watch="galleryWatch"
      :cart-qty="cartQty(galleryWatch.id)"
      @close="closeGallery"
      @add="emit('add', galleryWatch); closeGallery()"
    />
  </div>
</template>

<style scoped>
.pos-catalog {
  display: grid;
  gap: 0.75rem;
}

.pos-catalog__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: end;
}

.pos-catalog__toolbar .admin-input {
  box-sizing: border-box;
  min-height: 44px;
  min-width: 0;
  max-width: 100%;
  flex: 1 1 220px;
}

.pos-catalog__brand {
  display: grid;
  gap: 0.25rem;
  min-width: 160px;
}

.pos-catalog__brand span,
.pos-catalog__stock {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #9ca3af);
}

.pos-catalog__stock {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  letter-spacing: 0.04em;
  text-transform: none;
}

.pos-catalog__state {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.pos-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.pos-catalog__pages {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.pos-catalog__skeleton {
  height: 220px;
  border-radius: 2px;
  background: linear-gradient(90deg, #f3eee3, #e8e0d0, #f3eee3);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

@media (min-width: 1100px) {
  .pos-catalog__grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (min-width: 1400px) {
  .pos-catalog__grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .pos-catalog,
  .pos-catalog__toolbar {
    min-width: 0;
    max-width: 100%;
  }

  .pos-catalog__toolbar .admin-input,
  .pos-catalog__brand {
    flex-basis: 100%;
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
