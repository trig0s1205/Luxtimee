<script setup lang="ts">
import type {
  CreateWarrantyHistoryDto,
  OrderDto,
  OrderItemDto,
  OrderListPeriod,
  OrderStatus,
  OrdersListDto,
  OrderType,
  WarrantyReplacementType,
} from '@luxtime/shared';
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITION_LABELS,
  getOrderAllowedTransitions,
  statusBadgeTone,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';

const props = defineProps<{
  orderType: OrderType;
  title: string;
  seoTitle: string;
}>();

const api = useApi();
const toast = useToast();

const PAGE_SIZE = 15;

const period = ref<OrderListPeriod>('day');
const filter = ref<OrderStatus | 'ALL'>('ALL');
const page = ref(1);
const updatingId = ref<string | null>(null);
const expandedIds = ref<Set<string>>(new Set());
const warrantyItemId = ref<string | null>(null);
const savingWarrantyId = ref<string | null>(null);

const warrantyForm = reactive({
  damageDescription: '',
  replacementType: 'SAME_WATCH' as WarrantyReplacementType,
  replacementSku: '',
  replacementNotes: '',
});

const periodOptions: { key: OrderListPeriod; label: string }[] = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: '1 semana' },
  { key: 'month', label: '1 mes' },
  { key: 'all', label: 'Histórico' },
];

const statusFilters: Array<{ key: OrderStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'PENDIENTE', label: 'Pendientes' },
  { key: 'PAGADO', label: 'Pagados' },
  { key: 'ENVIADO', label: 'Enviados' },
  { key: 'ENTREGADO', label: 'Entregados' },
  { key: 'CANCELADO', label: 'Cancelados' },
];

function buildOrdersUrl() {
  const params = new URLSearchParams({
    period: period.value,
    page: String(page.value),
    limit: String(PAGE_SIZE),
    type: props.orderType,
  });
  if (filter.value !== 'ALL') params.set('status', filter.value);
  return `/orders?${params}`;
}

const emptyList: OrdersListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  period: 'day',
  periodLabel: 'Hoy',
};

const dataKey = computed(() => `admin-orders-${props.orderType.toLowerCase()}`);

const { data: ordersData, refresh, pending } = await useAsyncData(
  dataKey,
  () => api.get<OrdersListDto>(buildOrdersUrl()).catch(() => emptyList),
  { watch: [period, filter, page, () => props.orderType] },
);

watch([period, filter], () => {
  page.value = 1;
  expandedIds.value = new Set();
});

const orders = computed(() => ordersData.value?.items ?? []);
const totalOrders = computed(() => ordersData.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalOrders.value / PAGE_SIZE)));
const periodLabel = computed(() => ordersData.value?.periodLabel ?? 'Hoy');

function orderSku(order: OrderDto) {
  const skus = order.items.map((item) => item.productSku).filter(Boolean);
  if (!skus.length) return 'Sin SKU';
  if (skus.length === 1) return skus[0];
  return skus.join(', ');
}

function hasPendingWarranty(order: OrderDto) {
  return order.status === 'ENTREGADO' && order.items.some((item) => !item.warrantyRegistered);
}

function firstPendingItem(order: OrderDto) {
  return order.items.find((item) => !item.warrantyRegistered) ?? null;
}

function openWarrantyForm(order: OrderDto, item: OrderItemDto) {
  if (!isExpanded(order.id)) toggleExpanded(order.id);
  warrantyItemId.value = item.id;
  warrantyForm.damageDescription = '';
  warrantyForm.replacementType = 'SAME_WATCH';
  warrantyForm.replacementSku = '';
  warrantyForm.replacementNotes = '';
}

function closeWarrantyForm() {
  warrantyItemId.value = null;
}

async function submitWarranty(order: OrderDto, item: OrderItemDto) {
  if (!warrantyForm.damageDescription.trim()) {
    toast.error('Describe el daño del reloj.');
    return;
  }
  if (warrantyForm.replacementType === 'OTHER_WATCH' && !warrantyForm.replacementSku.trim()) {
    toast.error('Indica el SKU del reloj de reemplazo.');
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
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la garantía.'));
  } finally {
    savingWarrantyId.value = null;
  }
}

function isNationalOrder(order: OrderDto) {
  return order.shippingZone?.isNational ?? false;
}

function nextTransitions(order: OrderDto) {
  return getOrderAllowedTransitions(order.status, isNationalOrder(order));
}

function shippingLabel(order: OrderDto) {
  if (!order.shippingZone) return 'Sin zona';
  return order.shippingZone.isNational ? 'Envío nacional' : 'Área metropolitana';
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpanded(id: string) {
  return expandedIds.value.has(id);
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
  expandedIds.value = new Set();
}

async function transition(order: OrderDto, status: OrderStatus) {
  if (updatingId.value) return;
  if (!nextTransitions(order).includes(status)) return;

  const label = ORDER_TRANSITION_LABELS[status];
  const sku = orderSku(order);
  if (status === 'CANCELADO' && !confirm(`¿Cancelar el pedido ${sku}?`)) return;

  updatingId.value = order.id;
  try {
    await api.patch(`/orders/${order.id}/status`, { status });
    toast.success(`${label} — ${sku}`);
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo actualizar el pedido.'));
  } finally {
    updatingId.value = null;
  }
}

useSeoMeta({ title: props.seoTitle });
</script>

<template>
  <div class="orders-page">
    <UiToastContainer />
    <UiSectionHeader label="Ventas" :title="`${title} (${totalOrders})`" />
    <p class="orders-period-label">{{ periodLabel }}</p>

    <div class="orders-toolbar">
      <div class="orders-periods">
        <button
          v-for="item in periodOptions"
          :key="item.key"
          type="button"
          class="orders-filter-btn"
          :class="{ 'orders-filter-btn--active': period === item.key }"
          @click="period = item.key"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="orders-filters">
        <button
          v-for="item in statusFilters"
          :key="item.key"
          type="button"
          class="orders-filter-btn"
          :class="{ 'orders-filter-btn--active': filter === item.key }"
          @click="filter = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div v-if="pending && !orders.length" class="orders-empty">Cargando pedidos...</div>

    <div v-else class="orders-list">
      <article
        v-for="order in orders"
        :key="order.id"
        class="orders-row"
        :class="{ 'orders-row--open': isExpanded(order.id) }"
      >
        <button
          type="button"
          class="orders-row-summary"
          :aria-expanded="isExpanded(order.id)"
          @click="toggleExpanded(order.id)"
        >
          <svg
            class="orders-row-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>

          <span class="orders-row-sku">{{ orderSku(order) }}</span>
          <span class="orders-row-customer">{{ order.customerName }}</span>
          <span class="orders-row-total">{{ formatCop(order.total) }}</span>
          <span class="orders-row-date">{{ formatDate(order.createdAt) }}</span>

          <span class="orders-row-badges">
            <UiLuxBadge :tone="statusBadgeTone(order.status ?? undefined)">
              {{ order.status ? ORDER_STATUS_LABELS[order.status] : 'Sin estado' }}
            </UiLuxBadge>
            <UiLuxBadge :tone="isNationalOrder(order) ? 'nacional' : 'local'">
              {{ shippingLabel(order) }}
            </UiLuxBadge>
            <button
              v-if="hasPendingWarranty(order)"
              type="button"
              class="orders-warranty-btn"
              @click.stop="firstPendingItem(order) && openWarrantyForm(order, firstPendingItem(order)!)"
            >
              Registrar garantía
            </button>
          </span>
        </button>

        <div v-show="isExpanded(order.id)" class="orders-row-details">
          <div class="orders-detail-grid">
            <div>
              <p class="orders-detail-label">Cliente</p>
              <p>{{ order.customerName }}</p>
              <p v-if="order.customerPhone" class="orders-muted">{{ order.customerPhone }}</p>
              <p class="orders-muted">{{ order.customerAddress }}</p>
            </div>

            <div>
              <p class="orders-detail-label">Envío</p>
              <p>{{ shippingLabel(order) }}</p>
              <p v-if="order.shippingZone" class="orders-muted">
                {{ order.shippingZone.name }} — {{ formatCop(order.shippingCost) }}
              </p>
            </div>

            <div>
              <p class="orders-detail-label">Productos</p>
              <ul class="orders-items">
                <li v-for="item in order.items" :key="item.id" class="orders-item-row">
                  <span>
                    {{ item.productSku }} — {{ item.productName }} x{{ item.quantity }} — {{ formatCop(item.unitPrice * item.quantity) }}
                  </span>
                  <button
                    v-if="order.status === 'ENTREGADO' && !item.warrantyRegistered"
                    type="button"
                    class="orders-warranty-btn"
                    @click.stop="openWarrantyForm(order, item)"
                  >
                    Registrar garantía
                  </button>
                  <span v-else-if="item.warrantyRegistered" class="orders-warranty-done">Garantía registrada</span>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="order.paidAt || order.shippedAt || order.deliveredAt" class="orders-timeline">
            <span v-if="order.paidAt">Pagado: {{ formatDate(order.paidAt) }}</span>
            <span v-if="order.shippedAt">Enviado: {{ formatDate(order.shippedAt) }}</span>
            <span v-if="order.deliveredAt">Entregado: {{ formatDate(order.deliveredAt) }}</span>
          </div>

          <div
            v-if="warrantyItemId && order.items.some((item) => item.id === warrantyItemId)"
            class="orders-warranty-form"
          >
            <p class="orders-detail-label">Registrar garantía</p>
            <p class="orders-muted">
              Venta: {{ formatDate(order.deliveredAt) }} · Garantía: {{ formatDate(new Date().toISOString()) }}
            </p>
            <label>
              <span>Daño reportado</span>
              <textarea v-model="warrantyForm.damageDescription" rows="3" class="orders-warranty-textarea" />
            </label>
            <fieldset class="orders-warranty-radios">
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
            <label v-if="warrantyForm.replacementType === 'OTHER_WATCH'">
              <span>SKU del reloj entregado</span>
              <UiLuxInput v-model="warrantyForm.replacementSku" />
            </label>
            <label>
              <span>Notas (opcional)</span>
              <textarea v-model="warrantyForm.replacementNotes" rows="2" class="orders-warranty-textarea" />
            </label>
            <div class="orders-row-actions">
              <button
                type="button"
                class="orders-action-btn orders-action-btn--primary"
                :disabled="!!savingWarrantyId"
                @click.stop="submitWarranty(order, order.items.find((item) => item.id === warrantyItemId)!)"
              >
                {{ savingWarrantyId ? 'Guardando...' : 'Guardar garantía' }}
              </button>
              <button type="button" class="orders-action-btn" @click.stop="closeWarrantyForm">Cancelar</button>
            </div>
          </div>

          <footer v-if="nextTransitions(order).length" class="orders-row-actions">
            <button
              v-for="status in nextTransitions(order)"
              :key="status"
              type="button"
              class="orders-action-btn"
              :class="{
                'orders-action-btn--danger': status === 'CANCELADO',
                'orders-action-btn--primary': status !== 'CANCELADO',
              }"
              :disabled="updatingId === order.id"
              @click.stop="transition(order, status)"
            >
              {{ updatingId === order.id ? 'Actualizando...' : ORDER_TRANSITION_LABELS[status] }}
            </button>
          </footer>

          <p v-else-if="order.status === 'ENTREGADO' && !hasPendingWarranty(order)" class="orders-done">Pedido completado.</p>
          <p v-else-if="order.status === 'ENTREGADO' && hasPendingWarranty(order)" class="orders-done">Pedido entregado. Registra la garantía cuando corresponda.</p>
          <p v-else-if="order.status === 'CANCELADO'" class="orders-done orders-done--cancel">Pedido cancelado.</p>
        </div>
      </article>

      <p v-if="!orders.length" class="orders-empty">
        {{ filter === 'ALL' ? 'No hay pedidos en este periodo.' : 'No hay pedidos con este estado.' }}
      </p>
    </div>

    <nav v-if="totalPages > 1" class="orders-pagination" aria-label="Paginación de pedidos">
      <button
        type="button"
        class="orders-page-btn"
        :disabled="page <= 1 || pending"
        @click="goToPage(page - 1)"
      >
        Anterior
      </button>
      <span class="orders-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button
        type="button"
        class="orders-page-btn"
        :disabled="page >= totalPages || pending"
        @click="goToPage(page + 1)"
      >
        Siguiente
      </button>
    </nav>
  </div>
</template>

<style scoped>
.orders-page {
  max-width: 960px;
}

.orders-period-label {
  margin: -16px 0 20px;
  font-size: 12px;
  color: var(--lux-white-dim);
}

.orders-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.orders-periods,
.orders-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.orders-filter-btn {
  padding: 8px 14px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--lux-white-dim);
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.orders-filter-btn--active {
  color: var(--lux-gold);
  border-color: rgba(200, 169, 110, 0.35);
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.orders-row {
  border: var(--border-hairline);
  background: rgba(255, 255, 255, 0.02);
}

.orders-row-summary {
  display: grid;
  grid-template-columns: 16px 1.1fr 1fr auto auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  border: none;
  background: transparent;
  color: var(--lux-white);
  font-family: var(--lux-font-body);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.orders-row-chevron {
  color: var(--lux-white-dim);
  transition: transform 0.2s;
}

.orders-row--open .orders-row-chevron {
  transform: rotate(180deg);
}

.orders-row-sku {
  font-family: var(--lux-font-display);
  font-size: 14px;
  color: var(--lux-gold);
}

.orders-row-customer {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orders-row-total {
  font-family: var(--lux-font-display);
  font-size: 17px;
  color: var(--lux-white);
}

.orders-row-date {
  color: var(--lux-white-dim);
  font-size: 11px;
  white-space: nowrap;
}

.orders-row-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  grid-column: 2 / -1;
}

.orders-row-details {
  padding: 0 14px 14px 42px;
  border-top: var(--border-hairline);
}

.orders-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  padding-top: 14px;
  font-size: 13px;
}

.orders-detail-label {
  margin: 0 0 6px;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.orders-muted {
  margin: 2px 0 0;
  color: var(--lux-white-dim);
  font-size: 12px;
}

.orders-items {
  margin: 0;
  padding-left: 0;
  list-style: none;
  color: var(--lux-white-dim);
  font-size: 12px;
}

.orders-item-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.orders-warranty-btn {
  padding: 4px 8px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: transparent;
  color: var(--lux-gold);
  font-family: var(--lux-font-body);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.orders-warranty-btn:hover {
  border-color: var(--lux-gold);
}

.orders-warranty-done {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-gold);
}

.orders-warranty-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: var(--border-hairline);
}

.orders-warranty-form label,
.orders-warranty-radios {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.orders-warranty-radios {
  border: none;
  padding: 0;
}

.orders-warranty-radios legend {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.orders-warranty-radios label {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.orders-warranty-textarea {
  width: 100%;
  padding: 10px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--lux-white);
  font-family: var(--lux-font-body);
  font-size: 13px;
  text-transform: uppercase;
}

.orders-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--lux-white-dim);
}

.orders-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: var(--border-hairline);
}

.orders-action-btn {
  padding: 8px 14px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  background: transparent;
  color: var(--lux-white);
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.orders-action-btn--primary:hover:not(:disabled) {
  border-color: var(--lux-gold);
  color: var(--lux-gold);
}

.orders-action-btn--danger {
  border-color: rgba(255, 136, 136, 0.35);
  color: #ff8888;
}

.orders-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.orders-done {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--lux-gold);
}

.orders-done--cancel {
  color: #ff8888;
}

.orders-empty {
  color: var(--lux-white-dim);
  font-size: 13px;
}

.orders-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.orders-page-btn {
  padding: 8px 14px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--lux-white-dim);
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.orders-page-btn:hover:not(:disabled) {
  color: var(--lux-gold);
  border-color: rgba(200, 169, 110, 0.35);
}

.orders-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.orders-page-info {
  font-size: 12px;
  color: var(--lux-white-dim);
}

@media (max-width: 720px) {
  .orders-row-summary {
    grid-template-columns: 16px 1fr auto;
  }

  .orders-row-date {
    grid-column: 2;
  }

  .orders-row-badges {
    grid-column: 2 / -1;
  }
}
</style>
