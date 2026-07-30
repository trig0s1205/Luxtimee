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
const { confirm } = useConfirm();

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
  if (status === 'CANCELADO') {
    const ok = await confirm({
      title: `¿Cancelar el pedido ${sku}?`,
      destructive: true,
      confirmLabel: 'Cancelar pedido',
    });
    if (!ok) return;
  }

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
  <div class="admin-records-page orders-page">
    <UiToastContainer />
    <UiSectionHeader label="Ventas" :title="`${title} (${totalOrders})`" />
    <p class="admin-records-period-label">{{ periodLabel }}</p>

    <div class="admin-records-toolbar">
      <AdminFilterDropdown
        v-model="period"
        label="Periodo"
        :options="periodOptions.map((item) => ({ key: item.key, label: item.label }))"
      />
      <AdminFilterDropdown
        v-model="filter"
        label="Estado"
        :options="statusFilters.map((item) => ({ key: item.key, label: item.label }))"
      />
    </div>

    <div v-if="pending && !orders.length" class="admin-record-empty">Cargando pedidos...</div>

    <div v-else class="admin-records-list">
      <article
        v-for="order in orders"
        :key="order.id"
        class="admin-record-card"
        :class="{ 'admin-record-card--open': isExpanded(order.id) }"
      >
        <button
          type="button"
          class="admin-record-summary"
          :aria-expanded="isExpanded(order.id)"
          @click="toggleExpanded(order.id)"
        >
          <div class="admin-record-summary-main">
            <svg class="admin-record-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
            <div>
              <span class="admin-record-title">{{ orderSku(order) }}</span>
              <span class="admin-record-subtitle">{{ order.customerName }}</span>
            </div>
          </div>

          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(order.total) }}</span>
            <span class="admin-record-date">{{ formatDate(order.createdAt) }}</span>
          </div>

          <div class="admin-record-summary-actions" @click.stop>
            <AdminTagMenu :label="order.status ? ORDER_STATUS_LABELS[order.status] : 'Etiquetas'">
              <UiLuxBadge :tone="statusBadgeTone(order.status ?? undefined)">
                {{ order.status ? ORDER_STATUS_LABELS[order.status] : 'Sin estado' }}
              </UiLuxBadge>
              <UiLuxBadge :tone="isNationalOrder(order) ? 'nacional' : 'local'">
                {{ shippingLabel(order) }}
              </UiLuxBadge>
              <UiLuxBadge :tone="order.type === 'MAYORISTA' ? 'mayorista' : 'detal'">
                {{ order.type === 'MAYORISTA' ? 'Mayorista' : 'Detal' }}
              </UiLuxBadge>
            </AdminTagMenu>
          </div>
        </button>

        <div v-show="isExpanded(order.id)" class="admin-record-details">
          <div class="admin-record-details-inner">
            <AdminAccordionSection title="Cliente" :subtitle="order.customerName">
              <p>{{ order.customerName }}</p>
              <p v-if="order.customerPhone" class="admin-record-muted">{{ order.customerPhone }}</p>
              <p class="admin-record-muted">{{ order.customerAddress }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection title="Envío" :subtitle="shippingLabel(order)">
              <p>{{ shippingLabel(order) }}</p>
              <p v-if="order.shippingZone" class="admin-record-muted">
                {{ order.shippingZone.name }} — {{ formatCop(order.shippingCost) }}
              </p>
            </AdminAccordionSection>

            <AdminAccordionSection
              title="Productos"
              :subtitle="`${order.items.length} artículo${order.items.length === 1 ? '' : 's'}`"
            >
              <ul class="admin-record-list">
                <li v-for="item in order.items" :key="item.id" class="admin-record-item-row">
                  <span>
                    {{ item.productSku }} — {{ item.productName }} ×{{ item.quantity }}
                    <span class="admin-record-muted"> · {{ formatCop(item.unitPrice * item.quantity) }}</span>
                  </span>
                  <button
                    v-if="order.status === 'ENTREGADO' && !item.warrantyRegistered"
                    type="button"
                    class="admin-record-btn admin-record-btn--primary"
                    @click.stop="openWarrantyForm(order, item)"
                  >
                    Garantía
                  </button>
                  <span v-else-if="item.warrantyRegistered" class="admin-record-chip">Garantía ok</span>
                </li>
              </ul>
            </AdminAccordionSection>

            <AdminAccordionSection
              v-if="order.paidAt || order.shippedAt || order.deliveredAt"
              title="Historial"
              subtitle="Fechas del pedido"
            >
              <p v-if="order.paidAt" class="admin-record-muted">Pagado: {{ formatDate(order.paidAt) }}</p>
              <p v-if="order.shippedAt" class="admin-record-muted">Enviado: {{ formatDate(order.shippedAt) }}</p>
              <p v-if="order.deliveredAt" class="admin-record-muted">Entregado: {{ formatDate(order.deliveredAt) }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection
              v-if="warrantyItemId && order.items.some((item) => item.id === warrantyItemId)"
              title="Registrar garantía"
              :default-open="true"
            >
              <div class="admin-record-warranty-form">
                <p class="admin-record-muted">
                  Venta: {{ formatDate(order.deliveredAt) }} · Garantía: {{ formatDate(new Date().toISOString()) }}
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
                <label v-if="warrantyForm.replacementType === 'OTHER_WATCH'">
                  <span>SKU del reloj entregado</span>
                  <UiLuxInput v-model="warrantyForm.replacementSku" />
                </label>
                <label>
                  <span>Notas (opcional)</span>
                  <textarea v-model="warrantyForm.replacementNotes" rows="2" class="admin-record-textarea" />
                </label>
                <div class="admin-record-actions">
                  <button
                    type="button"
                    class="admin-record-btn admin-record-btn--primary"
                    :disabled="!!savingWarrantyId"
                    @click.stop="submitWarranty(order, order.items.find((item) => item.id === warrantyItemId)!)"
                  >
                    {{ savingWarrantyId ? 'Guardando...' : 'Guardar garantía' }}
                  </button>
                  <button type="button" class="admin-record-btn admin-record-btn--ghost" @click.stop="closeWarrantyForm">
                    Cancelar
                  </button>
                </div>
              </div>
            </AdminAccordionSection>

            <div v-if="nextTransitions(order).length" class="admin-record-actions">
              <button
                v-for="status in nextTransitions(order)"
                :key="status"
                type="button"
                class="admin-record-btn"
                :class="{
                  'admin-record-btn--danger': status === 'CANCELADO',
                  'admin-record-btn--primary': status !== 'CANCELADO',
                }"
                :disabled="updatingId === order.id"
                @click.stop="transition(order, status)"
              >
                {{ updatingId === order.id ? 'Actualizando...' : ORDER_TRANSITION_LABELS[status] }}
              </button>
              <button
                v-if="hasPendingWarranty(order)"
                type="button"
                class="admin-record-btn admin-record-btn--primary"
                @click.stop="firstPendingItem(order) && openWarrantyForm(order, firstPendingItem(order)!)"
              >
                Registrar garantía
              </button>
            </div>

            <p v-else-if="order.status === 'ENTREGADO' && !hasPendingWarranty(order)" class="admin-record-status-note">
              Pedido completado.
            </p>
            <p v-else-if="order.status === 'ENTREGADO' && hasPendingWarranty(order)" class="admin-record-status-note">
              Pedido entregado. Registra la garantía cuando corresponda.
            </p>
            <p v-else-if="order.status === 'CANCELADO'" class="admin-record-status-note admin-record-status-note--cancel">
              Pedido cancelado.
            </p>
          </div>
        </div>
      </article>

      <p v-if="!orders.length" class="admin-record-empty">
        {{ filter === 'ALL' ? 'No hay pedidos en este periodo.' : 'No hay pedidos con este estado.' }}
      </p>
    </div>

    <nav v-if="totalPages > 1" class="admin-records-pagination" aria-label="Paginación de pedidos">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="admin-records-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">
        Siguiente
      </button>
    </nav>
  </div>
</template>

