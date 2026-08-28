<script setup lang="ts">
import type { BrandDto, PaginatedResponse, WatchStaffDto } from '@luxtime/shared';

const modelValue = defineModel<string>({ default: '' });

const api = useApi();
const catalogStore = useAdminCatalogStore();

const selectedBrandSlug = ref('');
const loadingWatches = ref(false);
const watches = ref<WatchStaffDto[]>([]);

const brands = computed(() => catalogStore.brands);

onMounted(() => {
  catalogStore.ensureBrands(() => api.get<BrandDto[]>('/brands'));
});

watch(selectedBrandSlug, async (slug) => {
  modelValue.value = '';
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
</script>

<template>
  <div class="admin-warranty-picker">
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
      <span>Reloj en stock</span>
      <select
        v-model="modelValue"
        class="admin-record-select"
        :disabled="loadingWatches"
      >
        <option value="">
          {{ loadingWatches ? 'Cargando relojes...' : 'Seleccionar reloj' }}
        </option>
        <option
          v-for="watch in watches"
          :key="watch.id"
          :value="watch.sku"
        >
          {{ watch.model }} · {{ watch.sku }} · {{ watch.stock }} uds.
        </option>
      </select>
      <p v-if="!loadingWatches && !watches.length" class="admin-warranty-picker__empty">
        No hay relojes disponibles de esta marca.
      </p>
    </label>
  </div>
</template>

<style scoped>
.admin-warranty-picker {
  display: flex;
  flex-direction: column;
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

.admin-warranty-picker__empty {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
