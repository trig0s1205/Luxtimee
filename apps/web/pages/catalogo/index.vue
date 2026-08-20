<script setup lang="ts">
import type { BrandDto, CategoryDto, MechanismDto, PaginatedResponse, WatchPublicDto } from '@luxtime/shared';
import { normalizeGender, resolveCatalogRouteQuery, sanitizeCatalogQuery } from '~/utils/catalog-filters';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

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
const gender = ref(FILTER_NONE);
const minPrice = ref('');
const maxPrice = ref('');
const sort = ref<CatalogSort>('newest');
const searchQuery = ref('');
const debouncedSearch = ref('');
const loadPages = ref(1);

const { data: brands } = await useCachedAsyncData('catalog-brands', () =>
  $fetch<BrandDto[]>(`${apiBase}/brands/public`).catch(() => []),
  { staleTime: STOREFRONT_CACHE_MS.static },
);

const { data: categories } = await useCachedAsyncData('catalog-categories', () =>
  $fetch<CategoryDto[]>(`${apiBase}/categories/public`).catch(() => []),
  { staleTime: STOREFRONT_CACHE_MS.static },
);

const { data: mechanismsData } = await useCachedAsyncData('catalog-mechanisms', () =>
  $fetch<MechanismDto[]>(`${apiBase}/mechanisms/public`).catch(() => []),
  { staleTime: STOREFRONT_CACHE_MS.static },
);

const movements = computed(() => mechanismsData.value ?? []);

function buildCatalogParams() {
  return sanitizeCatalogQuery({
    sort: sort.value,
    page: 1,
    limit: PAGE_SIZE * loadPages.value,
    brand: brand.value || undefined,
    movement: movement.value || undefined,
    category: category.value || undefined,
    gender: gender.value ? normalizeGender(gender.value) : undefined,
    minPrice: minPrice.value !== '' && !Number.isNaN(Number(minPrice.value)) ? Number(minPrice.value) : undefined,
    maxPrice: maxPrice.value !== '' && !Number.isNaN(Number(maxPrice.value)) ? Number(maxPrice.value) : undefined,
    search: debouncedSearch.value.trim() || undefined,
  });
}

const catalogKey = computed(() => `catalog-products-${JSON.stringify(buildCatalogParams())}`);

const { data: catalogResult, pending, refresh } = await useCachedAsyncData<PaginatedResponse<WatchPublicDto>>(
  catalogKey,
  () =>
    $fetch<PaginatedResponse<WatchPublicDto>>(`${apiBase}/catalog`, {
      query: buildCatalogParams(),
    }),
  {
    default: (): PaginatedResponse<WatchPublicDto> => ({ data: [], total: 0, page: 1, limit: PAGE_SIZE }),
    staleTime: STOREFRONT_CACHE_MS.catalog,
    watch: [catalogKey],
  },
);

const products = computed(() => catalogResult.value?.data ?? []);
const total = computed(() => catalogResult.value?.total ?? 0);
const hasMore = computed(() => products.value.length < total.value);
const isInitialLoad = computed(() => pending.value && products.value.length === 0);
const hasActiveFilters = computed(() =>
  !!brand.value
  || !!movement.value
  || !!category.value
  || !!gender.value
  || minPrice.value !== ''
  || maxPrice.value !== ''
  || sort.value !== 'newest'
  || debouncedSearch.value.trim().length > 0,
);

const activeFilterCount = computed(() => [
  brand.value,
  movement.value,
  category.value,
  gender.value,
  minPrice.value !== '' ? minPrice.value : '',
  maxPrice.value !== '' ? maxPrice.value : '',
  sort.value !== 'newest' ? sort.value : '',
].filter(Boolean).length);

const filterDrawerOpen = ref(false);

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
  gender.value = FILTER_NONE;
  minPrice.value = '';
  maxPrice.value = '';
  sort.value = 'newest';
  searchQuery.value = '';
  debouncedSearch.value = '';
  loadPages.value = 1;
  skipFilterWatch = false;
  scheduleRefresh();
}

watch([brand, movement, category, gender, minPrice, maxPrice, sort], onFilterChange);

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
  title: 'Colección — LUXTIMEE Luxury Timepieces',
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

    <div class="catalog-mobile-bar">
        <button
          type="button"
          class="catalog-mobile-filter-btn"
          :class="{ 'has-active': activeFilterCount > 0 }"
          @click="filterDrawerOpen = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
          </svg>
          Filtros
          <span v-if="activeFilterCount > 0" class="catalog-mobile-filter-badge">{{ activeFilterCount }}</span>
        </button>

        <div class="catalog-mobile-search-wrap">
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

      <!-- Desktop: inline filter row -->
      <div class="catalog-filter-container catalog-filter-desktop">
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
              <option v-for="m in movements" :key="m.id" :value="m.name">{{ m.name }}</option>
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

      <!-- Mobile filter drawer -->
      <Teleport to="body">
        <Transition name="drawer">
          <div v-if="filterDrawerOpen" class="catalog-filter-drawer-overlay" @click.self="filterDrawerOpen = false">
            <div class="catalog-filter-drawer">
              <div class="catalog-filter-drawer__head">
                <span class="catalog-filter-drawer__title">Filtros</span>
                <button
                  type="button"
                  class="catalog-filter-drawer__close"
                  aria-label="Cerrar filtros"
                  @click="filterDrawerOpen = false"
                >
                  ×
                </button>
              </div>

              <div class="catalog-filter-drawer__body">
                <div class="catalog-drawer-field" :class="{ 'is-active': !!brand }">
                  <label class="catalog-drawer-label">{{ t('catalog.brand') }}</label>
                  <div class="catalog-field">
                    <select v-model="brand" class="catalog-select">
                      <option value="">Todas</option>
                      <option v-for="b in brands" :key="b.id" :value="b.slug">{{ b.name }}</option>
                    </select>
                    <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div class="catalog-drawer-field" :class="{ 'is-active': !!movement }">
                  <label class="catalog-drawer-label">{{ t('catalog.movement') }}</label>
                  <div class="catalog-field">
                    <select v-model="movement" class="catalog-select">
                      <option value="">Todos</option>
                      <option v-for="m in movements" :key="m.id" :value="m.name">{{ m.name }}</option>
                    </select>
                    <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div class="catalog-drawer-field" :class="{ 'is-active': !!category }">
                  <label class="catalog-drawer-label">{{ t('catalog.style') }}</label>
                  <div class="catalog-field">
                    <select v-model="category" class="catalog-select">
                      <option value="">Todos</option>
                      <option v-for="c in categories" :key="c.id" :value="c.slug">{{ c.name }}</option>
                    </select>
                    <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div class="catalog-drawer-field" :class="{ 'is-active': !!gender }">
                  <label class="catalog-drawer-label">{{ t('catalog.gender') }}</label>
                  <div class="catalog-field">
                    <select v-model="gender" class="catalog-select">
                      <option value="">Todos</option>
                      <option v-for="g in GENDER_OPTIONS" :key="g" :value="g">{{ g }}</option>
                    </select>
                    <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div class="catalog-drawer-field" :class="{ 'is-active': sort !== 'newest' }">
                  <label class="catalog-drawer-label">Ordenar</label>
                  <div class="catalog-field">
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
                </div>

                <div class="catalog-drawer-price-row">
                  <div class="catalog-drawer-field" :class="{ 'is-active': minPrice !== '' }">
                    <label class="catalog-drawer-label">{{ t('catalog.minPrice') }}</label>
                    <input v-model="minPrice" type="number" min="0" class="catalog-select catalog-price-input" :placeholder="t('catalog.minPrice')">
                  </div>
                  <div class="catalog-drawer-field" :class="{ 'is-active': maxPrice !== '' }">
                    <label class="catalog-drawer-label">{{ t('catalog.maxPrice') }}</label>
                    <input v-model="maxPrice" type="number" min="0" class="catalog-select catalog-price-input" :placeholder="t('catalog.maxPrice')">
                  </div>
                </div>
              </div>

              <div class="catalog-filter-drawer__foot">
                <button v-if="hasActiveFilters" type="button" class="catalog-drawer-clear" @click="clearFilters">
                  Limpiar filtros
                </button>
                <button type="button" class="catalog-drawer-apply" @click="filterDrawerOpen = false">
                  Ver {{ total }} resultado{{ total !== 1 ? 's' : '' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

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

/* —— Mobile toggle bar —— */
.catalog-mobile-bar {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 0 16px 20px;
  background: var(--black);
}

.catalog-mobile-filter-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 44px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--white-dim);
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.25s, background 0.25s;
}

.catalog-mobile-filter-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.catalog-mobile-filter-btn.has-active {
  border-color: rgba(200, 169, 110, 0.55);
  color: var(--gold);
}

.catalog-mobile-filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--black);
  font-size: 10px;
  font-weight: 700;
}

.catalog-mobile-search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.catalog-mobile-search-wrap .catalog-search-input {
  width: 100%;
}

/* Hide desktop filters on mobile */
@media (max-width: 767px) {
  .catalog-filter-desktop {
    display: none !important;
  }

  .catalog-mobile-bar {
    display: flex;
  }
}

/* Hide mobile bar on desktop */
@media (min-width: 768px) {
  .catalog-mobile-bar {
    display: none;
  }
}

/* —— Filter drawer (mobile) —— */
.catalog-filter-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
}

.catalog-filter-drawer {
  width: 100%;
  max-height: 90dvh;
  background: var(--black-2);
  border-top: 1px solid rgba(200, 169, 110, 0.2);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.catalog-filter-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.1);
}

.catalog-filter-drawer__title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--white);
}

.catalog-filter-drawer__close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  color: var(--white-dim);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, color 0.2s;
}

.catalog-filter-drawer__close:hover {
  border-color: rgba(200, 169, 110, 0.55);
  color: var(--gold);
}

.catalog-filter-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.catalog-drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.catalog-drawer-label {
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--white-dim);
  opacity: 0.7;
}

.catalog-drawer-field .catalog-field {
  width: 100%;
}

.catalog-drawer-field .catalog-select {
  width: 100%;
  min-width: 0;
}

.catalog-drawer-price-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.catalog-filter-drawer__foot {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(200, 169, 110, 0.1);
}

.catalog-drawer-clear {
  flex: 0 0 auto;
  padding: 0 16px;
  height: 48px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  border-radius: 6px;
  background: transparent;
  color: var(--gold);
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.catalog-drawer-apply {
  flex: 1;
  height: 48px;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, rgba(226, 201, 138, 0.95), rgba(154, 122, 69, 0.95));
  color: var(--black);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter 0.2s;
}

.catalog-drawer-apply:hover {
  filter: brightness(1.06);
}

/* —— Drawer transitions —— */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.28s ease;
}

.drawer-enter-active .catalog-filter-drawer,
.drawer-leave-active .catalog-filter-drawer {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .catalog-filter-drawer,
.drawer-leave-to .catalog-filter-drawer {
  transform: translateY(100%);
}

/* —— Skeleton —— */
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
}

@media (max-width: 640px) {
  .catalog-skeleton-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
}
</style>
