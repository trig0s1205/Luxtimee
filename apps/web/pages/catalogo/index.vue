<script setup lang="ts">
import type { BrandDto, CategoryDto, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { normalizeGender, resolveCatalogRouteQuery, sanitizeCatalogQuery } from '~/utils/catalog-filters';

const route = useRoute();
const apiBase = useApiBaseUrl();
const { observe } = useRevealObserver();
const { t } = useLocale();

const PAGE_SIZE = 30;
const GENDER_OPTIONS = ['Hombre', 'Mujer', 'Unisex'] as const;
const FILTER_NONE = '';

type CatalogSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc';

const brand = ref(FILTER_NONE);
const movement = ref(FILTER_NONE);
const category = ref(FILTER_NONE);
const available = ref(FILTER_NONE);
const gender = ref(FILTER_NONE);
const minPrice = ref('');
const maxPrice = ref('');
const sort = ref<CatalogSort>('newest');
const searchQuery = ref('');
const debouncedSearch = ref('');
const loadPages = ref(1);
const showEncargoHero = ref(false);

const { data: brands } = await useAsyncData('catalog-brands', () =>
  $fetch<BrandDto[]>(`${apiBase}/brands/public`).catch(() => []),
);

const { data: categories } = await useAsyncData('catalog-categories', () =>
  $fetch<CategoryDto[]>(`${apiBase}/categories/public`).catch(() => []),
);

const { data: filterMeta } = await useAsyncData('catalog-filter-meta', () =>
  $fetch<PaginatedResponse<WatchPublicDto>>(`${apiBase}/catalog`, {
    query: { limit: 200, page: 1, sort: 'newest' },
  }).catch(() => ({ data: [], total: 0, page: 1, limit: 200 })),
);

const movements = computed(() => {
  const set = new Set<string>();
  for (const w of filterMeta.value?.data ?? []) set.add(w.movementType);
  return [...set].sort();
});

function buildCatalogParams() {
  return sanitizeCatalogQuery({
    sort: sort.value,
    page: 1,
    limit: PAGE_SIZE * loadPages.value,
    brand: brand.value || undefined,
    movement: movement.value || undefined,
    category: category.value || undefined,
    available: available.value || undefined,
    gender: gender.value ? normalizeGender(gender.value) : undefined,
    minPrice: minPrice.value !== '' && !Number.isNaN(Number(minPrice.value)) ? Number(minPrice.value) : undefined,
    maxPrice: maxPrice.value !== '' && !Number.isNaN(Number(maxPrice.value)) ? Number(maxPrice.value) : undefined,
    search: debouncedSearch.value.trim() || undefined,
  });
}

const { data: catalogResult, pending, refresh } = await useAsyncData(
  'catalog-products',
  () =>
    $fetch<PaginatedResponse<WatchPublicDto>>(`${apiBase}/catalog`, {
      query: buildCatalogParams(),
    }),
  { default: () => ({ data: [], total: 0, page: 1, limit: PAGE_SIZE }) },
);

const products = computed(() => catalogResult.value?.data ?? []);
const total = computed(() => catalogResult.value?.total ?? 0);
const hasMore = computed(() => products.value.length < total.value);
const isInitialLoad = computed(() => pending.value && products.value.length === 0);
const hasActiveFilters = computed(() =>
  !!brand.value
  || !!movement.value
  || !!category.value
  || !!available.value
  || !!gender.value
  || minPrice.value !== ''
  || maxPrice.value !== ''
  || sort.value !== 'newest'
  || debouncedSearch.value.trim().length > 0,
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let skipFilterWatch = false;

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refresh();
  }, 0);
}

function onFilterChange() {
  if (skipFilterWatch) return;
  loadPages.value = 1;
  showEncargoHero.value = false;
  scheduleRefresh();
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = searchQuery.value;
    loadPages.value = 1;
    scheduleRefresh();
  }, 300);
}

function loadMore() {
  loadPages.value += 1;
  scheduleRefresh();
}

function clearSearch() {
  searchQuery.value = '';
  debouncedSearch.value = '';
  loadPages.value = 1;
  scheduleRefresh();
}

function clearFilters() {
  skipFilterWatch = true;
  brand.value = FILTER_NONE;
  movement.value = FILTER_NONE;
  category.value = FILTER_NONE;
  available.value = FILTER_NONE;
  gender.value = FILTER_NONE;
  minPrice.value = '';
  maxPrice.value = '';
  sort.value = 'newest';
  searchQuery.value = '';
  debouncedSearch.value = '';
  showEncargoHero.value = false;
  loadPages.value = 1;
  skipFilterWatch = false;
  scheduleRefresh();
}

watch([brand, movement, category, available, gender, minPrice, maxPrice, sort], onFilterChange);

watch(debouncedSearch, () => {
  showEncargoHero.value = debouncedSearch.value.trim().length > 0 && total.value === 0;
});

watch(() => route.query, (query) => {
  const preset = resolveCatalogRouteQuery(query as Record<string, unknown>);
  if (!preset.category) return;
  skipFilterWatch = true;
  category.value = preset.category;
  skipFilterWatch = false;
  loadPages.value = 1;
  scheduleRefresh();
}, { immediate: true });

watch(pending, (isPending) => {
  if (!isPending) nextTick(() => observe());
});

watch(products, () => {
  nextTick(() => observe());
});

onMounted(() => nextTick(() => observe()));

useSeoMeta({
  title: 'Colección — Luxtime Luxury Timepieces',
  description: 'Explora nuestra colección de relojes de lujo. Filtra por marca, mecanismo y disponibilidad.',
});
</script>

<template>
  <div>
    <section class="catalog-hero">
      <p class="section-label">{{ t('catalog.label') }}</p>
      <h1>{{ t('catalog.title') }}</h1>
      <p class="hero-tags" style="opacity:1;animation:none;margin-top:12px">
        Elegance · Presence · Style · {{ total }} {{ t('catalog.modelsAvailable') }}
      </p>
    </section>

    <div v-if="showEncargoHero" class="catalog-encargo">
      <p class="section-label">{{ t('catalog.encargoLabel') }}</p>
      <h2 class="section-title" style="font-size:clamp(28px,4vw,40px)">{{ t('catalog.encargoTitle') }}</h2>
      <p class="section-body" style="max-width:480px;margin:0 auto 24px">{{ t('catalog.encargoBody') }}</p>
      <NuxtLink to="/#contacto" class="btn-primary">{{ t('catalog.encargoCta') }}</NuxtLink>
    </div>

    <template v-else>
      <div class="catalog-filter-container">
        <div class="catalog-filters-row">
          <div class="catalog-field" :class="{ 'is-active': !!brand }">
            <select v-model="brand" class="catalog-select">
              <option value="" disabled hidden>{{ t('catalog.brand') }}</option>
              <option v-for="b in brands" :key="b.id" :value="b.slug">{{ b.name }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': !!movement }">
            <select v-model="movement" class="catalog-select">
              <option value="" disabled hidden>{{ t('catalog.movement') }}</option>
              <option v-for="m in movements" :key="m" :value="m">{{ m }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': !!category }">
            <select v-model="category" class="catalog-select">
              <option value="" disabled hidden>{{ t('catalog.style') }}</option>
              <option v-for="c in categories" :key="c.id" :value="c.slug">{{ c.name }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': !!gender }">
            <select v-model="gender" class="catalog-select">
              <option value="" disabled hidden>{{ t('catalog.gender') }}</option>
              <option v-for="g in GENDER_OPTIONS" :key="g" :value="g">{{ g }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': !!available }">
            <select v-model="available" class="catalog-select">
              <option value="" disabled hidden>{{ t('catalog.availability') }}</option>
              <option value="true">{{ t('catalog.available') }}</option>
              <option value="false">{{ t('catalog.soldOut') }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': sort !== 'newest' }">
            <select v-model="sort" class="catalog-select">
              <option value="newest">{{ t('catalog.newest') }}</option>
              <option value="oldest">{{ t('catalog.oldest') }}</option>
              <option value="price_asc">{{ t('catalog.priceAsc') }}</option>
              <option value="price_desc">{{ t('catalog.priceDesc') }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <div class="catalog-field" :class="{ 'is-active': minPrice !== '' }">
            <input
              v-model="minPrice"
              type="number"
              min="0"
              class="catalog-select catalog-price-input"
              :placeholder="t('catalog.minPrice')"
            >
          </div>

          <div class="catalog-field" :class="{ 'is-active': maxPrice !== '' }">
            <input
              v-model="maxPrice"
              type="number"
              min="0"
              class="catalog-select catalog-price-input"
              :placeholder="t('catalog.maxPrice')"
            >
          </div>

          <button
            v-if="hasActiveFilters"
            type="button"
            class="catalog-clear-filters"
            @click="clearFilters"
          >
            {{ t('catalog.clearFilters') }}
          </button>
        </div>

        <div class="catalog-search-field">
          <svg class="catalog-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            class="catalog-search-input"
            :placeholder="t('catalog.searchPlaceholder')"
            @input="onSearchInput"
          >
          <button
            v-if="searchQuery"
            type="button"
            class="catalog-search-clear"
            :aria-label="t('catalog.clearSearch')"
            @click="clearSearch"
          >
            ×
          </button>
        </div>
      </div>

      <section class="catalog-section">
        <div v-if="isInitialLoad" class="catalog-skeleton-grid" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="catalog-skeleton-card" />
        </div>

        <div v-else-if="products.length" class="catalog-grid">
          <CatalogProductCard
            v-for="(w, i) in products"
            :key="w.id"
            :watch="w"
            :delay="(i % 6) * 0.05"
          />
        </div>

        <p v-else class="text-center py-20 text-[var(--white-dim)]">{{ t('catalog.empty') }}</p>

        <button v-if="hasMore && !isInitialLoad" type="button" class="catalog-load-more" :disabled="pending" @click="loadMore">
          {{ t('catalog.loadMore') }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.catalog-price-input {
  text-transform: none;
  letter-spacing: normal;
}

.catalog-price-input::placeholder {
  color: var(--white-dim);
  opacity: 0.55;
}

.catalog-clear-filters {
  align-self: stretch;
  padding: 0 18px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: transparent;
  color: var(--gold);
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.catalog-clear-filters:hover {
  background: rgba(200, 169, 110, 0.12);
}

.catalog-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.catalog-skeleton-card {
  aspect-ratio: 3 / 4;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.09) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: catalog-shimmer 1.2s ease-in-out infinite;
}

@keyframes catalog-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 900px) {
  .catalog-skeleton-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .catalog-skeleton-grid {
    grid-template-columns: 1fr;
  }
}
</style>
