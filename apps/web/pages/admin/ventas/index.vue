<script setup lang="ts">
import type {
  CreateWarrantyHistoryDto,
  OrderDto,
  OrderItemDto,
  WarrantyReplacementType,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';
import { invalidateAdminCache } from '~/utils/admin-cache';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();

const PAGE_SIZE = 25;
const page = ref(1);
const lightboxSrc = ref<string | null>(null);
const expandedOrderId = ref<string | null>(null);
const warrantyItemId = ref<string | null>(null);
const savingWarrantyId = ref<string | null>(null);

const warrantyForm = reactive({
  damageDescription: '',
  replacementType: 'SAME_WATCH' as WarrantyReplacementType,
  replacementSku: '',
  replacementNotes: '',
});

type SalesListDto = { items: OrderDto[]; total: number; page: number; limit: number };

const emptyList: SalesListDto = { items: [], total: 0, page: 1, limit: PAGE_SIZE };

const dataKey = computed(() => `admin-ventas-${page.value}`);

const { data, refresh, pending } = useAdminCachedData(
  dataKey,
  () =>
    api
      .get<SalesListDto>(`/orders/sales?page=${page.value}&limit=${PAGE_SIZE}`)
      .catch(() => emptyList),
  { watch: [dataKey] },
);

const orders = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function firstImage(order: OrderDto): string | null {
  return order.items[0]?.productImage ?? null;
}

function orderSku(order: OrderDto): string {
  const skus = order.items.map((i) => i.productSku).filter(Boolean);
  return skus.length ? skus.join(', ') : '—';
}

function hasPendingWarranty(order: OrderDto) {
  return order.items.some((item) => !item.warrantyRegistered);
}

function firstPendingItem(order: OrderDto): OrderItemDto | null {
  return order.items.find((item) => !item.warrantyRegistered) ?? null;
}

function openWarrantyForm(order: OrderDto, item: OrderItemDto) {
  expandedOrderId.value = order.id;
  warrantyItemId.value = item.id;
  warrantyForm.damageDescription = '';
  warrantyForm.replacementType = 'SAME_WATCH';
  warrantyForm.replacementSku = '';
  warrantyForm.replacementNotes = '';
}

function closeWarrantyForm() {
  warrantyItemId.value = null;
}

async function submitWarranty(order: OrderDto) {
  const item = order.items.find((i) => i.id === warrantyItemId.value);
  if (!item) return;
  if (!warrantyForm.damageDescription.trim()) {
    toast.error('Describe el daño del reloj.');
    return;
  }
  if (warrantyForm.replacementType === 'OTHER_WATCH' && !warrantyForm.replacementSku.trim()) {
    toast.error('Selecciona el reloj de reemplazo.');
    return;
  }
  savingWarrantyId.value = item.id;
  try {
    const payload: CreateWarrantyHistoryDto = {
      orderItemId: item.id,
      damageDescription: warrantyForm.damageDescription,
      replacementType: warrantyForm.replacementType,
      replacementSku:
        warrantyForm.replacementType === 'OTHER_WATCH' ? warrantyForm.replacementSku : undefined,
      replacementNotes: warrantyForm.replacementNotes || undefined,
    };
    await api.post('/warranty-histories', payload);
    toast.success(`Garantía registrada — ${item.productSku}`);
    closeWarrantyForm();
    invalidateAdminCache(dataKey.value);
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la garantía.'));
  } finally {
    savingWarrantyId.value = null;
  }
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
  expandedOrderId.value = null;
  warrantyItemId.value = null;
}

useSeoMeta({ title: 'Ventas — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiToastContainer />

    <UiSectionHeader
      label="Módulo de ventas"
      :title="`Ventas entregadas (${total})`"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />

    <div v-if="pending && !orders.length" class="admin-record-empty">Cargando ventas...</div>

    <div v-else class="ventas-table-wrap">
      <table class="admin-table ventas-table">
        <thead>
          <tr>
            <th class="ventas-col-thumb">Foto</th>
            <th>Cliente</th>
            <th>Reloj</th>
            <th class="ventas-col-total">Total</th>
            <th class="ventas-col-date">Fecha entrega</th>
            <th class="ventas-col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="order in orders" :key="order.id">
            <tr :class="{ 'ventas-row--expanded': expandedOrderId === order.id }">
              <td class="ventas-col-thumb">
                <button
                  v-if="firstImage(order)"
                  type="button"
                  class="ventas-thumb-btn"
                  :aria-label="`Ver imagen de ${orderSku(order)}`"
                  @click="lightboxSrc = firstImage(order)"
                >
                  <img
                    :src="firstImage(order)!"
                    :alt="orderSku(order)"
                    class="ventas-thumb"
                    width="40"
                    height="40"
                  />
                </button>
                <span v-else class="ventas-thumb-placeholder">—</span>
              </td>
              <td>
                <span class="ventas-client-name">{{ order.customerName }}</span>
                <span v-if="order.customerPhone" class="ventas-muted">{{ order.customerPhone }}</span>
              </td>
              <td>
                <span class="ventas-sku">{{ orderSku(order) }}</span>
              </td>
              <td class="ventas-col-total">
                {{ formatCop(order.total) }}
              </td>
              <td class="ventas-col-date">
                {{ formatDate(order.deliveredAt) }}
              </td>
              <td class="ventas-col-actions">
                <template v-if="hasPendingWarranty(order)">
                  <button
                    type="button"
                    class="admin-record-btn admin-record-btn--primary ventas-warranty-btn"
                    @click="openWarrantyForm(order, firstPendingItem(order)!)"
                  >
                    Registrar garantía
                  </button>
                </template>
                <span v-else class="admin-record-chip">Garantía ok</span>
              </td>
            </tr>

            <tr
              v-if="expandedOrderId === order.id && warrantyItemId"
              class="ventas-warranty-row"
            >
              <td colspan="6">
                <div class="admin-record-warranty-form">
                  <p class="admin-record-muted">
                    Entrega: {{ formatDate(order.deliveredAt) }} · Garantía: {{ formatDate(new Date().toISOString()) }}
                  </p>
                  <label>
                    <span>Daño reportado</span>
                    <textarea v-model="warrantyForm.damageDescription" rows="3" class="admin-record-textarea" />
                  </label>
                  <fieldset class="admin-record-warranty-radios">
                    <legend>Reemplazo</legend>
                    <label>
                      <input v-model="warrantyForm.replacementType" type="radio" value="SAME_WATCH" />
                      Mismo reloj
                    </label>
                    <label>
                      <input v-model="warrantyForm.replacementType" type="radio" value="OTHER_WATCH" />
                      Otro reloj
                    </label>
                  </fieldset>
                  <AdminWarrantyReplacementPicker
                    v-if="warrantyForm.replacementType === 'OTHER_WATCH'"
                    :key="warrantyItemId ?? 'none'"
                    v-model="warrantyForm.replacementSku"
                  />
                  <label>
                    <span>Notas (opcional)</span>
                    <textarea v-model="warrantyForm.replacementNotes" rows="2" class="admin-record-textarea" />
                  </label>
                  <div class="admin-record-actions">
                    <button
                      type="button"
                      class="admin-record-btn admin-record-btn--primary"
                      :disabled="!!savingWarrantyId"
                      @click="submitWarranty(order)"
                    >
                      {{ savingWarrantyId ? 'Guardando...' : 'Guardar garantía' }}
                    </button>
                    <button
                      type="button"
                      class="admin-record-btn admin-record-btn--ghost"
                      @click="closeWarrantyForm(); expandedOrderId = null"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="!orders.length && !pending">
            <td colspan="6" class="admin-record-empty">No hay ventas registradas.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="totalPages > 1" class="admin-records-pagination" aria-label="Paginación de ventas">
      <button
        type="button"
        class="admin-records-page-btn"
        :disabled="page <= 1 || pending"
        @click="goToPage(page - 1)"
      >
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button
        type="button"
        class="admin-records-page-btn"
        :disabled="page >= totalPages || pending"
        @click="goToPage(page + 1)"
      >
        Siguiente
      </button>
    </nav>

    <Teleport to="body">
      <div
        v-if="lightboxSrc"
        class="ventas-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa de imagen"
        @click.self="lightboxSrc = null"
      >
        <button
          type="button"
          class="ventas-lightbox-close"
          aria-label="Cerrar"
          @click="lightboxSrc = null"
        >
          ✕
        </button>
        <img :src="lightboxSrc" alt="Vista previa" class="ventas-lightbox-img" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ventas-table-wrap {
  overflow-x: auto;
}

.ventas-table {
  width: 100%;
  border-collapse: collapse;
}

.ventas-table th,
.ventas-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--lux-border, #2a2a2a);
  font-size: 0.85rem;
  vertical-align: middle;
}

.ventas-table th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--lux-muted, #888);
  font-weight: 600;
}

.ventas-col-thumb { width: 56px; }
.ventas-col-total { width: 120px; }
.ventas-col-date  { width: 130px; }
.ventas-col-actions { width: 170px; text-align: right; }

.ventas-row--expanded td {
  background: var(--lux-surface-2, #141414);
}

.ventas-thumb-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: zoom-in;
  display: block;
}

.ventas-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

.ventas-thumb-placeholder {
  display: inline-block;
  width: 40px;
  height: 40px;
  background: var(--lux-surface-2, #1a1a1a);
  border-radius: 4px;
  line-height: 40px;
  text-align: center;
  color: var(--lux-muted, #888);
}

.ventas-client-name {
  display: block;
  font-weight: 500;
}

.ventas-muted {
  display: block;
  font-size: 0.75rem;
  color: var(--lux-muted, #888);
}

.ventas-sku {
  font-family: monospace;
  font-size: 0.82rem;
}

.ventas-warranty-btn {
  white-space: nowrap;
}

.ventas-warranty-row td {
  background: var(--lux-surface-2, #141414);
  padding: 16px 20px;
}

.ventas-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.ventas-lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 6px;
}

.ventas-lightbox-close {
  position: absolute;
  top: 16px;
  right: 20px;
  background: none;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
}
</style>
