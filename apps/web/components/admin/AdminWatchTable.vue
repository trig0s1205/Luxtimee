<script setup lang="ts">
import type { WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { watchPrimaryImage } from '~/utils/media-url';

const props = defineProps<{
  watches: WatchStaffDto[];
  loading?: boolean;
  selectionMode?: boolean;
  selectedIds?: string[];
  progressById?: Record<string, { status: string; progress: number }>;
}>();

const emit = defineEmits<{
  edit: [watch: WatchStaffDto];
  delete: [watch: WatchStaffDto];
  'toggle-select': [watch: WatchStaffDto];
  'toggle-visible': [on: boolean];
}>();

const colCount = computed(() => (props.selectionMode ? 8 : 7));

const allVisibleSelected = computed(
  () => !!props.watches.length && props.watches.every((watch) => props.selectedIds?.includes(watch.id)),
);

function jobOf(id: string) {
  return props.progressById?.[id];
}

function isBusy(id: string) {
  const status = jobOf(id)?.status;
  return status === 'queued' || status === 'running';
}

const statusLabels: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  AGOTADO: 'Agotado',
};

function statusClass(status: string) {
  switch (status) {
    case 'DISPONIBLE': return 'admin-status--available';
    case 'AGOTADO': return 'admin-status--out';
    default: return '';
  }
}

const lightboxSrc = ref<string | null>(null);

function openLightbox(src: string) {
  lightboxSrc.value = src;
}

function closeLightbox() {
  lightboxSrc.value = null;
}
</script>

<template>
  <div class="admin-table-wrap">
    <table class="admin-table" :class="{ 'admin-table--select': selectionMode }">
      <thead>
        <tr>
          <th v-if="selectionMode" class="admin-table-check">
            <input
              type="checkbox"
              :checked="allVisibleSelected"
              :disabled="!watches.length"
              aria-label="Seleccionar visibles"
              @change="emit('toggle-visible', ($event.target as HTMLInputElement).checked)"
            >
          </th>
          <th>Imagen</th>
          <th>SKU</th>
          <th>Marca & Modelo</th>
          <th>Precio público</th>
          <th>Stock</th>
          <th>Estado</th>
          <th class="admin-table-actions">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="colCount" class="admin-table-empty">
            <span class="admin-spinner" /> Cargando inventario...
          </td>
        </tr>
        <tr v-else-if="!watches.length">
          <td :colspan="colCount" class="admin-table-empty">No hay relojes registrados.</td>
        </tr>
        <template v-else>
        <template v-for="watch in watches" :key="watch.id">
        <tr class="admin-table-row" :class="{ 'admin-table-row--selected': selectedIds?.includes(watch.id) }">
          <td v-if="selectionMode" class="admin-table-check">
            <input
              type="checkbox"
              :checked="selectedIds?.includes(watch.id)"
              :disabled="isBusy(watch.id)"
              :aria-label="`Seleccionar ${watch.brand.name} ${watch.model}`"
              @change="emit('toggle-select', watch)"
            >
          </td>
          <td>
            <button
              type="button"
              class="admin-table-thumb"
              :disabled="!watchPrimaryImage(watch)"
              :title="watchPrimaryImage(watch) ? 'Ver imagen' : undefined"
              @click="watchPrimaryImage(watch) && openLightbox(watchPrimaryImage(watch)!)"
            >
              <img v-if="watchPrimaryImage(watch)" :src="watchPrimaryImage(watch)" :alt="watch.model">
              <div v-else class="admin-table-thumb-placeholder">
                <span class="admin-table-thumb-pending" title="Multimedia en proceso">
                  <span class="admin-spinner admin-spinner--xs" />
                </span>
              </div>
            </button>
          </td>
          <td class="admin-table-sku">{{ watch.sku }}</td>
          <td>
            <div class="admin-table-product">
              <strong>{{ watch.brand.name }}</strong>
              <span>{{ watch.model }}</span>
            </div>
          </td>
          <td>{{ formatCop(watch.retailPrice) }}</td>
          <td>{{ watch.stock }}</td>
          <td>
            <span class="admin-status" :class="statusClass(watch.status)">
              {{ statusLabels[watch.status] ?? watch.status }}
            </span>
          </td>
          <td class="admin-table-actions">
            <button type="button" class="admin-action-btn" title="Editar" @click="emit('edit', watch)">
              ✎
            </button>
            <button type="button" class="admin-action-btn admin-action-btn--danger" title="Eliminar" :disabled="isBusy(watch.id)" @click="emit('delete', watch)">
              ×
            </button>
          </td>
        </tr>
        <tr v-if="jobOf(watch.id) && jobOf(watch.id)!.status !== 'done'" class="admin-table-progress-row">
          <td :colspan="colCount">
            <div
              class="admin-watch-progress"
              :class="{ 'admin-watch-progress--error': jobOf(watch.id)!.status === 'error' }"
            >
              <span :style="{ width: `${jobOf(watch.id)!.progress}%` }" />
            </div>
          </td>
        </tr>
        </template>
        </template>
      </tbody>
    </table>

    <div
      v-if="lightboxSrc"
      class="admin-table-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="closeLightbox"
    >
      <button type="button" class="admin-table-lightbox-close" aria-label="Cerrar" @click="closeLightbox">
        ×
      </button>
      <img :src="lightboxSrc" alt="Vista previa del reloj" class="admin-table-lightbox-img">
    </div>
  </div>
</template>

<style scoped>
.admin-table-wrap {
  overflow-x: auto;
  max-width: 100%;
  border: var(--border-hairline);
  background: var(--lux-black-2);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
  font-family: var(--lux-font-body);
}

.admin-table th {
  padding: 14px 16px;
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: left;
  color: var(--lux-white-dim);
  border-bottom: 1px solid rgba(200, 169, 110, 0.1);
  white-space: nowrap;
}

.admin-table td {
  padding: 14px 16px;
  font-size: 12px;
  color: var(--lux-white);
  border-bottom: var(--border-hairline);
  vertical-align: middle;
}

.admin-table-row:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.admin-table-row--selected td {
  background: rgba(200, 169, 110, 0.06);
}

.admin-table-check {
  width: 36px;
  padding-right: 0;
}

.admin-table-check input {
  accent-color: #c8a96e;
  cursor: pointer;
}

.admin-table-progress-row td {
  padding: 0 16px 8px;
  border-bottom: var(--border-hairline);
}

.admin-watch-progress {
  height: 3px;
  background: rgba(200, 169, 110, 0.15);
  overflow: hidden;
}

.admin-watch-progress > span {
  display: block;
  height: 100%;
  background: #c8a96e;
  transition: width 0.15s linear;
}

.admin-watch-progress--error > span {
  background: #ff5555;
}

.admin-action-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.admin-table-thumb {
  width: 72px;
  height: 72px;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: var(--lux-black-3);
  overflow: hidden;
  cursor: zoom-in;
}

.admin-table-thumb:disabled {
  cursor: default;
}

.admin-table-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.admin-table-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-table-thumb-pending {
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-spinner--xs {
  width: 14px;
  height: 14px;
  border-width: 2px;
  border-color: rgba(200, 169, 110, 0.2);
  border-top-color: #c8a96e;
}

.admin-table-sku {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--lux-white-dim);
  white-space: nowrap;
}

.admin-table-product strong {
  display: block;
  font-weight: 500;
  color: var(--lux-white);
}

.admin-table-product span {
  display: block;
  font-size: 11px;
  color: var(--lux-white-dim);
  margin-top: 2px;
}

.admin-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 2px;
}

.admin-status::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.admin-status--available {
  color: #4cdf8b;
  background: rgba(76, 223, 139, 0.1);
  border: 1px solid rgba(76, 223, 139, 0.25);
}

.admin-status--available::before {
  background: #4cdf8b;
}

.admin-status--out {
  color: #ff5555;
  background: rgba(255, 85, 85, 0.1);
  border: 1px solid rgba(255, 85, 85, 0.25);
}

.admin-status--out::before {
  background: #ff5555;
}

.admin-table-actions {
  text-align: right;
  white-space: nowrap;
}

.admin-action-btn {
  width: 30px;
  height: 30px;
  margin-left: 6px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--lux-white-dim);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.admin-action-btn:hover {
  border-color: var(--lux-gold);
  color: var(--lux-gold);
}

.admin-action-btn--danger:hover {
  border-color: #ff5555;
  color: #ff5555;
}

.admin-table-empty {
  text-align: center;
  padding: 40px;
  color: var(--lux-white-dim);
}

.admin-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: var(--border-hairline);
  border-top-color: var(--lux-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.admin-table-lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.88);
}

.admin-table-lightbox-img {
  max-width: min(90vw, 560px);
  max-height: 85vh;
  object-fit: contain;
}

.admin-table-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  background: transparent;
  color: var(--lux-white);
  font-size: 22px;
  cursor: pointer;
}

@media (max-width: 1200px) {
  .admin-table:not(.admin-table--select) th:nth-child(4),
  .admin-table:not(.admin-table--select) td:nth-child(4),
  .admin-table--select th:nth-child(5),
  .admin-table--select td:nth-child(5) {
    display: none;
  }
}

@media (max-width: 768px) {
  .admin-table th,
  .admin-table td {
    padding: 10px 8px;
  }

  .admin-table-thumb {
    width: 52px;
    height: 52px;
  }

  .admin-table-actions {
    position: sticky;
    right: 0;
    background: var(--lux-black-2);
    box-shadow: -8px 0 10px rgba(255, 255, 255, 0.85);
  }

  .admin-table:not(.admin-table--select) th:nth-child(4),
  .admin-table:not(.admin-table--select) td:nth-child(4),
  .admin-table:not(.admin-table--select) th:nth-child(5),
  .admin-table:not(.admin-table--select) td:nth-child(5),
  .admin-table--select th:nth-child(5),
  .admin-table--select td:nth-child(5),
  .admin-table--select th:nth-child(6),
  .admin-table--select td:nth-child(6) {
    display: none;
  }
}
</style>
