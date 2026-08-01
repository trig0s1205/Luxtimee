<script setup lang="ts">
import type { WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { watchPrimaryImage } from '~/utils/media-url';

const props = defineProps<{
  watches: WatchStaffDto[];
  loading?: boolean;
}>();

const emit = defineEmits(['edit', 'delete']);

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
</script>

<template>
  <div class="admin-table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th>Imagen</th>
          <th>SKU</th>
          <th>Marca & Modelo</th>
          <th>Referencia</th>
          <th>Precio público</th>
          <th>Stock</th>
          <th>Estado</th>
          <th class="admin-table-actions">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="8" class="admin-table-empty">
            <span class="admin-spinner" /> Cargando inventario...
          </td>
        </tr>
        <tr v-else-if="!watches.length">
          <td colspan="8" class="admin-table-empty">No hay relojes registrados.</td>
        </tr>
        <tr v-for="watch in watches" :key="watch.id" class="admin-table-row">
          <td>
            <div class="admin-table-thumb">
              <img v-if="watchPrimaryImage(watch)" :src="watchPrimaryImage(watch)" :alt="watch.model">
              <div v-else class="admin-table-thumb-placeholder" />
            </div>
          </td>
          <td class="admin-table-sku">{{ watch.sku }}</td>
          <td>
            <div class="admin-table-product">
              <strong>{{ watch.brand.name }}</strong>
              <span>{{ watch.model }}</span>
            </div>
          </td>
          <td>{{ watch.reference || '—' }}</td>
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
            <button type="button" class="admin-action-btn admin-action-btn--danger" title="Eliminar" @click="emit('delete', watch)">
              ×
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.admin-table-wrap {
  overflow: hidden;
  border: var(--border-hairline);
  background: rgba(17, 17, 17, 0.8);
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

.admin-table-thumb {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: var(--lux-black-3);
  overflow: hidden;
}

.admin-table-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-table-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.04);
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

@media (max-width: 1200px) {
  .admin-table th:nth-child(4),
  .admin-table td:nth-child(4) {
    display: none;
  }
}

@media (max-width: 768px) {
  .admin-table th,
  .admin-table td {
    padding: 10px 12px;
  }

  .admin-table th:nth-child(4),
  .admin-table td:nth-child(4),
  .admin-table th:nth-child(5),
  .admin-table td:nth-child(5) {
    display: none;
  }
}
</style>
