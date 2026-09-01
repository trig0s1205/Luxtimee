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
const lightboxSrc = ref<string | null>(null);

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

const selectedWatch = computed(() =>
  watches.value.find((watch) => watch.sku === modelValue.value) ?? null,
);

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

function openLightbox(src: string) {
  lightboxSrc.value = src;
}

function closeLightbox() {
  lightboxSrc.value = null;
}
</script>

<template>
  <div class="admin-warranty-picker">
    <div class="admin-warranty-picker__filters">
      <label class="admin-warranty-picker__field">
        <span>Marca</span>
        <select v-model="selectedBrandSlug" class="admin-warranty-picker__control">
          <option value="">Seleccionar marca</option>
          <option v-for="brand in brands" :key="brand.id" :value="brand.slug">
            {{ brand.name }}
          </option>
        </select>
      </label>

      <label v-if="selectedBrandSlug" class="admin-warranty-picker__field">
        <span>Modelo o SKU</span>
        <input
          v-model="modelSearch"
          type="search"
          class="admin-warranty-picker__control"
          placeholder="Buscar por nombre, modelo o SKU..."
        >
      </label>
    </div>

    <p v-if="selectedWatch" class="admin-warranty-picker__selected">
      Reloj elegido: <strong>{{ selectedWatch.model }}</strong> · {{ selectedWatch.sku }}
    </p>

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
        <article
          v-for="watch in filteredWatches"
          :key="watch.id"
          class="admin-warranty-picker__card"
          :class="{ 'admin-warranty-picker__card--selected': modelValue === watch.sku }"
        >
          <button
            type="button"
            class="admin-warranty-picker__thumb"
            :disabled="!watchPrimaryImage(watch)"
            :title="watchPrimaryImage(watch) ? 'Ampliar imagen' : undefined"
            @click="watchPrimaryImage(watch) && openLightbox(watchPrimaryImage(watch)!)"
          >
            <img
              v-if="watchPrimaryImage(watch)"
              :src="watchPrimaryImage(watch)"
              :alt="watch.model"
              loading="lazy"
            >
            <span v-else class="admin-warranty-picker__thumb-empty">Sin foto</span>
          </button>

          <div class="admin-warranty-picker__meta">
            <strong>{{ watch.model }}</strong>
            <span>{{ watch.sku }}</span>
            <span>{{ watch.stock }} uds.</span>
          </div>

          <button
            type="button"
            class="admin-warranty-picker__select"
            :class="{ 'admin-warranty-picker__select--active': modelValue === watch.sku }"
            @click="selectWatch(watch.sku)"
          >
            {{ modelValue === watch.sku ? 'Seleccionado para garantía' : 'Seleccionar para garantía' }}
          </button>
        </article>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="lightboxSrc"
        class="admin-warranty-picker__lightbox"
        role="dialog"
        aria-modal="true"
        @click.self="closeLightbox"
      >
        <button type="button" class="admin-warranty-picker__lightbox-close" aria-label="Cerrar" @click="closeLightbox">
          ×
        </button>
        <img :src="lightboxSrc" alt="Vista ampliada del reloj" class="admin-warranty-picker__lightbox-img">
      </div>
    </Teleport>
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.admin-warranty-picker__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-warranty-picker__field span {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__control {
  width: 100%;
  padding: 10px 12px;
  border: var(--border-hairline);
  border-radius: 2px;
  background: transparent;
  color: var(--lux-white);
  font-family: var(--lux-font-body);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.admin-warranty-picker__control:focus {
  border-color: rgba(200, 169, 110, 0.45);
}

.admin-warranty-picker__control option {
  background: var(--lux-black-2);
  color: var(--lux-white);
}

.admin-warranty-picker__selected {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  background: rgba(200, 169, 110, 0.08);
  font-size: 12px;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__selected strong {
  color: var(--lux-white);
  font-weight: 500;
}

.admin-warranty-picker__empty {
  margin: 0;
  font-size: 12px;
  color: var(--lux-white-dim);
}

.admin-warranty-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
  padding: 2px;
}

.admin-warranty-picker__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: var(--lux-black-3);
}

.admin-warranty-picker__card--selected {
  border-color: var(--lux-gold);
  background: rgba(200, 169, 110, 0.08);
}

.admin-warranty-picker__thumb {
  aspect-ratio: 1;
  width: 100%;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.12);
  background: var(--lux-black-2);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
}

.admin-warranty-picker__thumb:disabled {
  cursor: default;
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
  color: var(--lux-white);
}

.admin-warranty-picker__meta span {
  font-size: 10px;
  color: var(--lux-white-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-warranty-picker__select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(200, 169, 110, 0.28);
  background: transparent;
  color: var(--lux-gold);
  font-family: var(--lux-font-body);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.admin-warranty-picker__select:hover {
  border-color: var(--lux-gold);
  background: rgba(200, 169, 110, 0.08);
}

.admin-warranty-picker__select--active {
  border-color: var(--lux-gold);
  background: rgba(200, 169, 110, 0.14);
  color: var(--lux-white);
}

.admin-warranty-picker__lightbox {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.9);
}

.admin-warranty-picker__lightbox-img {
  max-width: min(90vw, 640px);
  max-height: 85vh;
  object-fit: contain;
}

.admin-warranty-picker__lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: transparent;
  color: var(--lux-white);
  font-size: 22px;
  cursor: pointer;
}
</style>
