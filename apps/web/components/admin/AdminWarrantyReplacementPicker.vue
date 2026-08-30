<script setup lang="ts">
import type { BrandDto, PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { watchPrimaryImage } from '~/utils/media-url';

const modelValue = defineModel<string>({ default: '' });

const api = useApi();
const catalogStore = useAdminCatalogStore();

const selectedBrandSlug = ref('');
const modelSearch = ref('');
const loadingWatches = ref(false);
const watches = ref<WatchStaffDto[]>([]);

const brands = computed(() => catalogStore.brands);

const filteredWatches = computed(() => {
  const q = modelSearch.value.trim().toLowerCase();
  if (!q) return watches.value;
  return watches.value.filter((watch) => {
    const haystack = [
      watch.model,
      watch.sku,
      watch.reference,
      watch.brand?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

onMounted(() => {
  catalogStore.ensureBrands(() => api.get<BrandDto[]>('/brands'));
});

watch(selectedBrandSlug, async (slug) => {
  modelValue.value = '';
  modelSearch.value = '';
  watches.value = [];
  if (!slug) return;

  loadingWatches.value = true;
  try {
    const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
      brand: slug,
      status: 'DISPONIBLE',
      limit: 100,
    });
    watches.value = res.data.filter((watch) => watch.stock > 0);
  } catch {
    watches.value = [];
  } finally {
    loadingWatches.value = false;
  }
});

function selectWatch(sku: string) {
  modelValue.value = modelValue.value === sku ? '' : sku;
}
</script>

<template>
  <div class="admin-warranty-picker">
    <div class="admin-warranty-picker__filters">
      <label>
        <span>Marca</span>
        <select v-model="selectedBrandSlug" class="admin-record-select">
          <option value="">Seleccionar marca</option>
          <option v-for="brand in brands" :key="brand.id" :value="brand.slug">
            {{ brand.name }}
          </option>
        </select>
      </label>

      <label v-if="selectedBrandSlug">
        <span>Modelo o SKU</span>
        <input
          v-model="modelSearch"
          type="search"
          class="admin-record-select admin-warranty-picker__search"
          placeholder="Buscar por nombre, modelo o SKU..."
        >
      </label>
    </div>

    <div v-if="selectedBrandSlug" class="admin-warranty-picker__results">
      <p v-if="loadingWatches" class="admin-warranty-picker__empty">
        Cargando relojes...
      </p>
      <p v-else-if="!watches.length" class="admin-warranty-picker__empty">
        No hay relojes disponibles de esta marca.
      </p>
      <p v-else-if="!filteredWatches.length" class="admin-warranty-picker__empty">
        Ningún reloj coincide con la búsqueda.
      </p>
      <div v-else class="admin-warranty-picker__grid">
        <button
          v-for="watch in filteredWatches"
          :key="watch.id"
          type="button"
          class="admin-warranty-picker__card"
          :class="{ 'admin-warranty-picker__card--selected': modelValue === watch.sku }"
          @click="selectWatch(watch.sku)"
        >
          <div class="admin-warranty-picker__thumb">
            <img
              v-if="watchPrimaryImage(watch)"
              :src="watchPrimaryImage(watch)"
              :alt="watch.model"
              loading="lazy"
            >
            <span v-else class="admin-warranty-picker__thumb-empty">Sin foto</span>
          </div>
          <div class="admin-warranty-picker__meta">
            <strong>{{ watch.model }}</strong>
            <span>{{ watch.sku }}</span>
            <span>{{ watch.stock }} uds.</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-warranty-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-warranty-picker__filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.admin-warranty-picker label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-warranty-picker label span {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__search {
  cursor: text;
}

.admin-warranty-picker__empty {
  margin: 0;
  font-size: 12px;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
  padding: 2px;
}

.admin-warranty-picker__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: var(--lux-black-3);
  color: var(--lux-white);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.admin-warranty-picker__card:hover {
  border-color: rgba(200, 169, 110, 0.4);
}

.admin-warranty-picker__card--selected {
  border-color: var(--lux-gold);
  background: rgba(200, 169, 110, 0.08);
}

.admin-warranty-picker__thumb {
  aspect-ratio: 1;
  border: 1px solid rgba(200, 169, 110, 0.1);
  background: var(--lux-black-2);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-warranty-picker__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.admin-warranty-picker__thumb-empty {
  font-size: 10px;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.admin-warranty-picker__meta strong {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-warranty-picker__meta span {
  font-size: 10px;
  color: var(--lux-white-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
