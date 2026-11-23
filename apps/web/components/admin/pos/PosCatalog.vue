<script setup lang="ts">
import type { PosCatalogPageDto, PosCatalogWatchDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { hasActiveCatalogFilters, safeCatalogItems } from '~/utils/pos-catalog';

const props = defineProps<{
  cartQtyById: Record<string, number>;
}>();

const emit = defineEmits<{
  add: [watch: PosCatalogWatchDto];
  previewClosed: [];
  refreshed: [items: PosCatalogWatchDto[]];
}>();

const api = useApi();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const silentBusy = ref(false);
const loadingMore = ref(false);
const loadError = ref<string | null>(null);
const items = ref<PosCatalogWatchDto[]>([]);
const total = ref(0);
const page = ref(1);
const hasMore = ref(false);
const galleryWatch = ref<PosCatalogWatchDto | null>(null);
const sentinel = ref<HTMLElement | null>(null);

const search = ref(typeof route.query.search === 'string' ? route.query.search : '');

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let abort: AbortController | null = null;
let observer: IntersectionObserver | null = null;

const searchActive = computed(() => hasActiveCatalogFilters([search.value]));

function syncQuery() {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'tab') continue;
    if (
      key === 'brand' ||
      key === 'category' ||
      key === 'gender' ||
      key === 'dialColor' ||
      key === 'strapMaterial' ||
      key === 'minPrice' ||
      key === 'maxPrice' ||
      key === 'sort'
    ) {
      continue;
    }
    if (typeof value === 'string' && value) query[key] = value;
  }
  if (search.value) query.search = search.value;
  else delete query.search;
  void router.replace({ query });
}

function clearSearch() {
  search.value = '';
  void reload();
}

function buildQuery(nextPage: number) {
  return {
    page: nextPage,
    limit: 24,
    search: search.value || undefined,
  };
}

let catalogGeneration = 0;

async function loadPage(nextPage: number, append: boolean) {
  catalogGeneration += 1;
  abort?.abort();
  abort = new AbortController();
  if (append) loadingMore.value = true;
  else {
    loading.value = true;
    loadError.value = null;
  }
  try {
    const data = await api.get<PosCatalogPageDto>(
      '/pos/catalog',
      buildQuery(nextPage),
      { signal: abort.signal },
    );
    const list = safeCatalogItems<PosCatalogWatchDto>(data);
    if (!Array.isArray((data as { items?: unknown })?.items)) {
      console.warn('[POS catalog] respuesta sin items[]', data);
    }
    page.value = Number(data?.page) || nextPage;
    total.value = Number(data?.total) || list.length;
    hasMore.value = Boolean(data?.hasMore);
    items.value = append ? [...items.value, ...list] : list;
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') return;
    const message = extractApiErrorMessage(err, 'No se pudo cargar el catálogo.');
    loadError.value = message;
    if (!append) items.value = [];
    toast.error(message);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function reload() {
  syncQuery();
  page.value = 1;
  await loadPage(1, false);
}

let silentFlight: Promise<void> | null = null;

async function reloadSilent() {
  if (silentFlight) return silentFlight;
  if (loading.value || loadingMore.value) return;
  silentFlight = (async () => {
    const generation = catalogGeneration;
    silentBusy.value = true;
    try {
      const pages = Math.max(1, page.value);
      const collected: PosCatalogWatchDto[] = [];
      let last: PosCatalogPageDto | null = null;
      for (let next = 1; next <= pages; next += 1) {
        const data = await api.get<PosCatalogPageDto>('/pos/catalog', buildQuery(next));
        if (generation !== catalogGeneration) return;
        last = data;
        collected.push(...safeCatalogItems<PosCatalogWatchDto>(data));
      }
      if (generation !== catalogGeneration) return;
      page.value = Number(last?.page) || pages;
      total.value = Number(last?.total) || collected.length;
      hasMore.value = Boolean(last?.hasMore);
      items.value = collected;
      emit('refreshed', collected);
    } catch {
      /* refresco silencioso */
    } finally {
      silentBusy.value = false;
      silentFlight = null;
    }
  })();
  return silentFlight;
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  await loadPage(page.value + 1, true);
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void reload();
  }, 300);
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

onMounted(async () => {
  await loadPage(1, false);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    },
    { rootMargin: '240px' },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => {
  abort?.abort();
  observer?.disconnect();
  if (searchTimer) clearTimeout(searchTimer);
});

watch(sentinel, (el, _, onCleanup) => {
  if (!observer) return;
  if (el) observer.observe(el);
  onCleanup(() => {
    if (el) observer?.unobserve(el);
  });
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
      >
      <button
        type="button"
        class="admin-record-btn admin-record-btn--ghost"
        :disabled="silentBusy"
        @click="reloadSilent()"
      >
        {{ silentBusy ? 'Actualizando…' : 'Actualizar' }}
      </button>
      <p v-if="!loading && !loadError" class="admin-record-muted">
        {{ total }} reloj{{ total === 1 ? '' : 'es' }}
      </p>
    </div>

    <div v-if="loading && !items.length" class="pos-catalog__state">
      <p class="admin-record-muted">Cargando catálogo…</p>
      <div class="pos-catalog__grid">
        <div v-for="n in 8" :key="n" class="pos-catalog__skeleton" />
      </div>
    </div>

    <div v-else-if="loadError" class="pos-catalog__state admin-record-empty">
      <p>{{ loadError }}</p>
      <button
        type="button"
        class="admin-record-btn admin-record-btn--primary"
        @click="reload"
      >
        Reintentar
      </button>
    </div>

    <div v-else-if="!items.length" class="pos-catalog__state admin-record-empty">
      <p>
        No hay relojes disponibles{{ searchActive ? ' con esta búsqueda' : '' }}.
      </p>
      <button
        v-if="searchActive"
        type="button"
        class="admin-record-btn admin-record-btn--ghost"
        @click="clearSearch"
      >
        Limpiar búsqueda
      </button>
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

    <div ref="sentinel" class="pos-catalog__sentinel" />
    <button
      v-if="hasMore && !loadError"
      type="button"
      class="admin-record-btn admin-record-btn--ghost"
      :disabled="loadingMore"
      @click="loadMore"
    >
      {{ loadingMore ? 'Cargando…' : 'Cargar más' }}
    </button>

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
  align-items: center;
}

.pos-catalog__toolbar .admin-input {
  box-sizing: border-box;
  min-height: 44px;
  min-width: 0;
  max-width: 100%;
  flex: 1 1 220px;
}

.pos-catalog__state {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.pos-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 0.5rem;
}

@media (max-width: 700px) {
  .pos-catalog,
  .pos-catalog__toolbar {
    min-width: 0;
    max-width: 100%;
  }

  .pos-catalog__toolbar .admin-input {
    flex-basis: 100%;
  }
}

.pos-catalog__skeleton {
  height: 88px;
  border-radius: 2px;
  background: linear-gradient(90deg, #f3eee3, #e8e0d0, #f3eee3);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.pos-catalog__sentinel {
  height: 1px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
