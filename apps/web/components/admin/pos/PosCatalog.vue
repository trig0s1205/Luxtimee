<script setup lang="ts">
import type {
  PosCatalogFacetsDto,
  PosCatalogPageDto,
  PosCatalogWatchDto,
} from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';

const props = defineProps<{
  cartQtyById: Record<string, number>;
}>();

const emit = defineEmits<{
  add: [watch: PosCatalogWatchDto];
}>();

const api = useApi();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const filtersOpen = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const items = ref<PosCatalogWatchDto[]>([]);
const total = ref(0);
const page = ref(1);
const hasMore = ref(false);
const facets = ref<PosCatalogFacetsDto | null>(null);
const galleryWatch = ref<PosCatalogWatchDto | null>(null);
const sentinel = ref<HTMLElement | null>(null);

const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const brand = ref(typeof route.query.brand === 'string' ? route.query.brand : '');
const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
const gender = ref(typeof route.query.gender === 'string' ? route.query.gender : '');
const dialColor = ref(typeof route.query.dialColor === 'string' ? route.query.dialColor : '');
const strapMaterial = ref(
  typeof route.query.strapMaterial === 'string' ? route.query.strapMaterial : '',
);
const minPrice = ref(typeof route.query.minPrice === 'string' ? route.query.minPrice : '');
const maxPrice = ref(typeof route.query.maxPrice === 'string' ? route.query.maxPrice : '');
const sort = ref(
  typeof route.query.sort === 'string' ? route.query.sort : 'newest',
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let abort: AbortController | null = null;
let observer: IntersectionObserver | null = null;

const activeFilterCount = computed(() =>
  [brand.value, category.value, gender.value, dialColor.value, strapMaterial.value, minPrice.value, maxPrice.value, search.value]
    .filter(Boolean).length,
);

const chips = computed(() => {
  const list: Array<{ key: string; label: string }> = [];
  if (search.value) list.push({ key: 'search', label: `Buscar: ${search.value}` });
  if (brand.value) {
    const name = facets.value?.brands.find((b) => b.slug === brand.value)?.name ?? brand.value;
    list.push({ key: 'brand', label: name });
  }
  if (category.value) {
    const name =
      facets.value?.categories.find((c) => c.slug === category.value)?.name ??
      category.value;
    list.push({ key: 'category', label: name });
  }
  if (gender.value) list.push({ key: 'gender', label: gender.value });
  if (dialColor.value) list.push({ key: 'dialColor', label: dialColor.value });
  if (strapMaterial.value) list.push({ key: 'strapMaterial', label: strapMaterial.value });
  if (minPrice.value) list.push({ key: 'minPrice', label: `Desde ${minPrice.value}` });
  if (maxPrice.value) list.push({ key: 'maxPrice', label: `Hasta ${maxPrice.value}` });
  return list;
});

function syncQuery() {
  const query: Record<string, string> = { tab: 'catalogo' };
  if (search.value) query.search = search.value;
  if (brand.value) query.brand = brand.value;
  if (category.value) query.category = category.value;
  if (gender.value) query.gender = gender.value;
  if (dialColor.value) query.dialColor = dialColor.value;
  if (strapMaterial.value) query.strapMaterial = strapMaterial.value;
  if (minPrice.value) query.minPrice = minPrice.value;
  if (maxPrice.value) query.maxPrice = maxPrice.value;
  if (sort.value && sort.value !== 'newest') query.sort = sort.value;
  void router.replace({ query });
}

function clearFilters() {
  search.value = '';
  brand.value = '';
  category.value = '';
  gender.value = '';
  dialColor.value = '';
  strapMaterial.value = '';
  minPrice.value = '';
  maxPrice.value = '';
  sort.value = 'newest';
  void reload();
}

function clearChip(key: string) {
  if (key === 'search') search.value = '';
  if (key === 'brand') brand.value = '';
  if (key === 'category') category.value = '';
  if (key === 'gender') gender.value = '';
  if (key === 'dialColor') dialColor.value = '';
  if (key === 'strapMaterial') strapMaterial.value = '';
  if (key === 'minPrice') minPrice.value = '';
  if (key === 'maxPrice') maxPrice.value = '';
  void reload();
}

function buildQuery(nextPage: number) {
  return {
    page: nextPage,
    limit: 24,
    search: search.value || undefined,
    brand: brand.value || undefined,
    category: category.value || undefined,
    gender: gender.value || undefined,
    dialColor: dialColor.value || undefined,
    strapMaterial: strapMaterial.value || undefined,
    minPrice: minPrice.value ? Number(minPrice.value) : undefined,
    maxPrice: maxPrice.value ? Number(maxPrice.value) : undefined,
    sort: sort.value || 'newest',
  };
}

async function loadPage(nextPage: number, append: boolean) {
  abort?.abort();
  abort = new AbortController();
  if (append) loadingMore.value = true;
  else loading.value = true;
  try {
    const data = await api.get<PosCatalogPageDto>(
      '/pos/catalog',
      buildQuery(nextPage),
      { signal: abort.signal },
    );
    page.value = data.page;
    total.value = data.total;
    hasMore.value = data.hasMore;
    items.value = append ? [...items.value, ...data.items] : data.items;
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError') return;
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el catálogo.'));
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

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  await loadPage(page.value + 1, true);
}

async function loadFacets() {
  try {
    facets.value = await api.get<PosCatalogFacetsDto>('/pos/catalog/facets');
  } catch {
    /* ignore */
  }
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

defineExpose({
  reload: async () => {
    await Promise.all([reload(), loadFacets()]);
  },
});

onMounted(async () => {
  await Promise.all([loadFacets(), loadPage(1, false)]);
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

watch([brand, category, gender, dialColor, strapMaterial, minPrice, maxPrice, sort], () => {
  void reload();
});
</script>

<template>
  <div class="pos-catalog">
    <div class="pos-catalog__toolbar">
      <button
        type="button"
        class="admin-btn"
        @click="filtersOpen = !filtersOpen"
      >
        Filtros{{ activeFilterCount ? ` (${activeFilterCount})` : '' }}
      </button>
      <select v-model="sort" class="admin-input">
        <option value="newest">Más recientes</option>
        <option value="price_asc">Precio: menor a mayor</option>
        <option value="price_desc">Precio: mayor a menor</option>
        <option value="brand_asc">Marca (A–Z)</option>
      </select>
    </div>

    <div v-show="filtersOpen || activeFilterCount" class="pos-catalog__filters">
      <input
        v-model="search"
        class="admin-input"
        type="search"
        placeholder="Buscar en catálogo"
        @input="onSearchInput"
      >
      <select v-model="brand" class="admin-input">
        <option value="">Marca</option>
        <option
          v-for="item in facets?.brands ?? []"
          :key="item.slug"
          :value="item.slug"
        >
          {{ item.name }} ({{ item.count }})
        </option>
      </select>
      <select v-model="category" class="admin-input">
        <option value="">Categoría</option>
        <option
          v-for="item in facets?.categories ?? []"
          :key="item.slug"
          :value="item.slug"
        >
          {{ item.name }} ({{ item.count }})
        </option>
      </select>
      <select v-model="gender" class="admin-input">
        <option value="">Género</option>
        <option
          v-for="item in facets?.genders ?? []"
          :key="item.value"
          :value="item.value"
        >
          {{ item.value }} ({{ item.count }})
        </option>
      </select>
      <select v-model="dialColor" class="admin-input">
        <option value="">Color de esfera</option>
        <option
          v-for="item in facets?.dialColors ?? []"
          :key="item.value"
          :value="item.value"
        >
          {{ item.value }} ({{ item.count }})
        </option>
      </select>
      <select v-model="strapMaterial" class="admin-input">
        <option value="">Correa</option>
        <option
          v-for="item in facets?.strapMaterials ?? []"
          :key="item.value"
          :value="item.value"
        >
          {{ item.value }} ({{ item.count }})
        </option>
      </select>
      <input
        v-model="minPrice"
        class="admin-input"
        type="number"
        min="0"
        :placeholder="`Desde ${facets?.priceRange.min ?? 0}`"
      >
      <input
        v-model="maxPrice"
        class="admin-input"
        type="number"
        min="0"
        :placeholder="`Hasta ${facets?.priceRange.max ?? 0}`"
      >
    </div>

    <div v-if="chips.length" class="pos-catalog__chips">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="pos-catalog__chip"
        @click="clearChip(chip.key)"
      >
        {{ chip.label }} ×
      </button>
      <button type="button" class="admin-link-btn" @click="clearFilters">
        Limpiar filtros
      </button>
    </div>

    <div v-if="loading && !items.length" class="pos-catalog__grid">
      <div v-for="n in 8" :key="n" class="pos-catalog__skeleton" />
    </div>

    <p v-else-if="!items.length" class="admin-empty">
      No hay relojes disponibles con estos filtros
    </p>

    <div v-else class="pos-catalog__grid">
      <PosWatchCard
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
      v-if="hasMore"
      type="button"
      class="admin-btn"
      :disabled="loadingMore"
      @click="loadMore"
    >
      {{ loadingMore ? 'Cargando…' : 'Cargar más' }}
    </button>

    <PosGalleryModal
      v-if="galleryWatch"
      :watch="galleryWatch"
      :cart-qty="cartQty(galleryWatch.id)"
      @close="galleryWatch = null"
      @add="emit('add', galleryWatch); galleryWatch = null"
    />
  </div>
</template>

<style scoped>
.pos-catalog {
  display: grid;
  gap: 0.75rem;
}

.pos-catalog__toolbar,
.pos-catalog__filters,
.pos-catalog__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.pos-catalog__filters .admin-input,
.pos-catalog__toolbar .admin-input {
  min-height: 44px;
  min-width: 140px;
}

.pos-catalog__chip {
  min-height: 36px;
  border: 1px solid var(--admin-border, #e5e7eb);
  background: #fff;
  border-radius: 999px;
  padding: 0 0.75rem;
  cursor: pointer;
}

.pos-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.85rem;
}

.pos-catalog__skeleton {
  aspect-ratio: 3 / 4;
  background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6);
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

@media (min-width: 768px) {
  .pos-catalog__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .pos-catalog__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
