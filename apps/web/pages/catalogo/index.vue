<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';

const route = useRoute();
const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { t } = useLocale();

const PAGE_SIZE = 24;

const brand = ref('all');
const movement = ref('all');
const available = ref('all');
const sort = ref('newest');
const searchQuery = ref('');
const visibleLimit = ref(PAGE_SIZE);
const showEncargoHero = ref(false);

const { data: brands } = await useAsyncData('catalog-brands', () => catalog.listBrands());

const { data: allProducts, pending } = await useAsyncData('catalog-all', () =>
  catalog.listCatalog({ limit: 200, sort: 'newest' }),
);

const movements = computed(() => {
  const set = new Set<string>();
  for (const w of allProducts.value?.data ?? []) set.add(w.movementType);
  return [...set].sort();
});

function productMatchesSearch(w: WatchPublicDto, q: string) {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return (
    w.model.toLowerCase().includes(s)
    || w.slug.toLowerCase().includes(s)
    || w.brand.name.toLowerCase().includes(s)
    || w.movementType.toLowerCase().includes(s)
  );
}

const filtered = computed(() => {
  let list = [...(allProducts.value?.data ?? [])];
  if (brand.value !== 'all') list = list.filter((w) => w.brand.slug === brand.value);
  if (movement.value !== 'all') list = list.filter((w) => w.movementType === movement.value);
  if (available.value === 'true') list = list.filter((w) => w.stock > 0);
  if (available.value === 'false') list = list.filter((w) => w.stock === 0);
  if (searchQuery.value.trim()) list = list.filter((w) => productMatchesSearch(w, searchQuery.value));
  if (sort.value === 'price-desc') list.sort((a, b) => b.retailPrice - a.retailPrice);
  else if (sort.value === 'price-asc') list.sort((a, b) => a.retailPrice - b.retailPrice);
  return list;
});

const visible = computed(() => filtered.value.slice(0, visibleLimit.value));
const total = computed(() => filtered.value.length);
const hasMore = computed(() => visibleLimit.value < total.value);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    visibleLimit.value = PAGE_SIZE;
    showEncargoHero.value = searchQuery.value.trim().length > 0 && total.value === 0;
  }, 250);
}

function loadMore() {
  visibleLimit.value += PAGE_SIZE;
}

function clearSearch() {
  searchQuery.value = '';
  onSearchInput();
}

watch(() => route.query.filter, (f) => {
  if (typeof f === 'string' && f) movement.value = f;
}, { immediate: true });

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
          <div class="catalog-field" :class="{ 'is-active': brand !== 'all' }">
            <select v-model="brand" class="catalog-select" @change="visibleLimit = PAGE_SIZE">
              <option value="all">{{ t('catalog.brand') }}</option>
              <option v-for="b in brands" :key="b.id" :value="b.slug">{{ b.name }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <div class="catalog-field" :class="{ 'is-active': movement !== 'all' }">
            <select v-model="movement" class="catalog-select" @change="visibleLimit = PAGE_SIZE">
              <option value="all">{{ t('catalog.movement') }}</option>
              <option v-for="m in movements" :key="m" :value="m">{{ m }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <div class="catalog-field" :class="{ 'is-active': available !== 'all' }">
            <select v-model="available" class="catalog-select" @change="visibleLimit = PAGE_SIZE">
              <option value="all">{{ t('catalog.availability') }}</option>
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
              <option value="price-desc">{{ t('catalog.priceDesc') }}</option>
              <option value="price-asc">{{ t('catalog.priceAsc') }}</option>
            </select>
            <svg class="catalog-field-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
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
        <div v-if="pending" class="text-center py-20 text-[var(--white-dim)]">{{ t('catalog.loading') }}</div>
        <div v-else-if="visible.length" class="catalog-grid">
          <CatalogProductCard
            v-for="(w, i) in visible"
            :key="w.id"
            :watch="w"
            :delay="(i % 6) * 0.05"
          />
        </div>
        <p v-else class="text-center py-20 text-[var(--white-dim)]">{{ t('catalog.empty') }}</p>
        <button v-if="hasMore" type="button" class="catalog-load-more" @click="loadMore">{{ t('catalog.loadMore') }}</button>
      </section>
    </template>
  </div>
</template>
