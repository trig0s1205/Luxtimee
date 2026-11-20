<script setup lang="ts">
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITION_LABELS,
  PAYMENT_METHOD_LABELS,
  getOrderAllowedTransitions,
  statusBadgeTone,
  type CreateWarrantyHistoryDto,
  type OrderDto,
  type OrderItemDto,
  type OrderListPeriod,
  type OrdersListDto,
  OrderSource,
  type OrderStatusValue,
  type OrderType,
  PaymentMethod,
  type WarrantyReplacementType,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { extractApiErrorMessage } from '~/utils/api-error';
import { orderDeliveryNotes, orderHasDeliveryNotes } from '~/utils/order-delivery-notes';
import { formatOrderExtras } from '~/utils/wholesale-extras';
import { searchEmptyMessage } from '~/utils/search-empty';

const props = defineProps<{
  orderType: OrderType;
  title: string;
  seoTitle: string;
  source?: OrderSource;
}>();

const api = useApi();
const toast = useToast();
const auth = useAuthStore();
const { confirm } = useConfirm();
const config = useRuntimeConfig();

function isReceiptVoided(order: OrderDto) {
  return order.receiptVoided || Boolean(order.receipt?.voidedAt);
}

function voidReasonText(order: OrderDto) {
  return order.receipt?.voidReason?.trim() ?? '';
}

function canDownloadReceipt(order: OrderDto) {
  if (isReceiptVoided(order) || order.status === OrderStatus.CANCELADO) return false;
  return (
    order.status === OrderStatus.PAGADO ||
    order.status === OrderStatus.ENVIADO ||
    order.status === OrderStatus.ENTREGADO
  );
}

function downloadReceipt(order: OrderDto) {
  if (!canDownloadReceipt(order)) return;
  window.open(`${config.public.apiBaseUrl}/receipts/order/${order.id}/pdf`, '_blank');
}

const voidTarget = ref<OrderDto | null>(null);
const voidReasonInput = ref('');
const voidPending = ref(false);
const voidReasonClean = computed(() => voidReasonInput.value.trim());
const voidReasonValid = computed(() => {
  const length = voidReasonClean.value.length;
  return length >= 5 && length <= 500;
});

function canVoidSale(order: OrderDto) {
  const role = auth.user?.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return false;
  if (props.source !== OrderSource.LOCAL && order.source !== OrderSource.LOCAL) return false;
  if (order.status === OrderStatus.CANCELADO || order.canceledAt || isReceiptVoided(order)) {
    return false;
  }
  return true;
}

function openVoid(order: OrderDto) {
  voidTarget.value = order;
  voidReasonInput.value = '';
}

function closeVoid() {
  if (voidPending.value) return;
  voidTarget.value = null;
  voidReasonInput.value = '';
}

async function confirmVoid() {
  const order = voidTarget.value;
  if (!order || !voidReasonValid.value || voidPending.value) return;
  voidPending.value = true;
  try {
    await api.post(`/pos/sales/${order.id}/void`, { reason: voidReasonClean.value });
    toast.success(`Venta anulada — ${order.readableId}`);
    voidTarget.value = null;
    voidReasonInput.value = '';
    invalidateAdminCache(dataKey.value);
    invalidateAdminCachePrefix('admin-orders-');
    invalidateMoneyCaches();
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo anular la venta.'));
  } finally {
    voidPending.value = false;
  }
}

const PAGE_SIZE = 15;

const period = ref<OrderListPeriod>('day');
const filter = ref<OrderStatus | 'ALL'>('ALL');
const page = ref(1);
const searchInput = ref('');
const searchTerm = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const updatingId = ref<string | null>(null);
const expandedIds = ref<Set<string>>(new Set());
const warrantyItemId = ref<string | null>(null);
const savingWarrantyId = ref<string | null>(null);
const editingOrder = ref<OrderDto | null>(null);
const deletingId = ref<string | null>(null);
const previewSrc = ref<string | null>(null);
const paymentMethodByOrder = ref<Record<string, PaymentMethod>>({});

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: PaymentMethod.NO_ESPECIFICADO, label: PAYMENT_METHOD_LABELS.NO_ESPECIFICADO },
  { value: PaymentMethod.EFECTIVO, label: PAYMENT_METHOD_LABELS.EFECTIVO },
  { value: PaymentMethod.TRANSFERENCIA, label: PAYMENT_METHOD_LABELS.TRANSFERENCIA },
  { value: PaymentMethod.DATAFONO_BOLD, label: PAYMENT_METHOD_LABELS.DATAFONO_BOLD },
];

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
  { key: OrderStatus.PENDIENTE, label: 'Pendientes' },
  { key: OrderStatus.PAGADO, label: 'Pagados' },
  { key: OrderStatus.ENVIADO, label: 'Enviados' },
  { key: OrderStatus.ENTREGADO, label: 'Entregados' },
  { key: OrderStatus.CANCELADO, label: 'Cancelados' },
];

function buildOrdersUrl() {
  const params = new URLSearchParams({
    period: period.value,
    page: String(page.value),
    limit: String(PAGE_SIZE),
    type: props.orderType,
  });
  if (props.source) params.set('source', props.source);
  if (filter.value !== 'ALL') params.set('status', filter.value);
  if (searchTerm.value) params.set('search', searchTerm.value);
  return `/orders?${params}`;
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm.value = searchInput.value.trim();
    page.value = 1;
    expandedIds.value = new Set();
  }, 300);
}

const emptyList: OrdersListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  period: 'day',
  periodLabel: 'Hoy',
};

const dataKey = computed(() =>
  `admin-orders-${props.orderType.toLowerCase()}-${props.source ?? 'any'}-${period.value}-${filter.value}-${searchTerm.value}-${page.value}`,
);

const { data: ordersData, refresh, pending } = useAdminCachedData(
  dataKey,
  () => api.get<OrdersListDto>(buildOrdersUrl()).catch(() => emptyList),
  { watch: [dataKey] },
);

watch([period, filter], () => {
  page.value = 1;
  expandedIds.value = new Set();
});

const orders = computed(() => ordersData.value?.items ?? []);
const totalOrders = computed(() => ordersData.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalOrders.value / PAGE_SIZE)));
const periodLabel = computed(
  () => periodOptions.find((item) => item.key === period.value)?.label ?? 'Hoy',
);
const searchMiss = computed(() => searchEmptyMessage({
  term: searchTerm.value,
  pending: pending.value,
  count: orders.value.length,
  message: 'No se encontraron pedidos',
}));

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

function isNationalOrder(order: OrderDto) {
  return order.shippingZone?.isNational ?? false;
}

function canRegisterBalance(order: OrderDto) {
  return order.balanceDue > 0
    && order.status !== 'ENTREGADO'
    && order.status !== 'CANCELADO';
}

function invalidateMoneyCaches() {
  invalidateAdminCachePrefix('profit-dashboard-');
  invalidateAdminCache('health-dashboard');
  invalidateAdminCache('admin-revenue-chart');
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

async function transition(order: OrderDto, status: OrderStatusValue) {
  if (updatingId.value) return;
  if (!nextTransitions(order).includes(status)) return;

  const label = ORDER_TRANSITION_LABELS[status];
  const sku = orderSku(order);
  const payload: {
    status: OrderStatusValue;
    confirmBalancePaid?: boolean;
    paymentMethod?: PaymentMethod;
  } = { status };
  if (status === 'CANCELADO') {
    const ok = await confirm({
      title: `¿Cancelar el pedido ${sku}?`,
      destructive: true,
      confirmLabel: 'Cancelar pedido',
    });
    if (!ok) return;
  }
  if (status === 'PAGADO') {
    payload.paymentMethod =
      paymentMethodByOrder.value[order.id] ?? 'NO_ESPECIFICADO';
  }
  if (status === 'ENTREGADO' && order.balanceDue > 0) {
    const ok = await confirm({
      title: 'Saldo pendiente',
      message: `Falta por pagar ${formatCop(order.balanceDue)}. ¿Confirmas que el saldo ya fue pagado? Se registrará automáticamente.`,
      confirmLabel: 'Confirmar saldo y entregar',
    });
    if (!ok) return;
    payload.confirmBalancePaid = true;
  }

  updatingId.value = order.id;
  try {
    await api.patch(`/orders/${order.id}/status`, payload);
    toast.success(status === 'CANCELADO' ? `Pedido cancelado — ${sku}` : `${label} — ${sku}`);
    invalidateAdminCache(dataKey.value);
    invalidateAdminCachePrefix('admin-orders-');
    invalidateMoneyCaches();
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo actualizar el pedido.'));
  } finally {
    updatingId.value = null;
  }
}

async function deleteOrder(order: OrderDto) {
  const ok = await confirm({
    title: 'Eliminar pedido',
    message: `¿Eliminar permanentemente el pedido ${orderSku(order)}? Si el inventario fue descontado, se restaurará.`,
    confirmLabel: 'Eliminar',
    destructive: true,
  });
  if (!ok) return;
  deletingId.value = order.id;
  try {
    await api.del(`/orders/${order.id}`);
    toast.success(`Pedido eliminado — ${orderSku(order)}`);
    invalidateAdminCache(dataKey.value);
    invalidateAdminCachePrefix('admin-orders-');
    invalidateMoneyCaches();
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar el pedido.'));
  } finally {
    deletingId.value = null;
  }
}

async function registerBalance(order: OrderDto) {
  if (!canRegisterBalance(order) || updatingId.value) return;
  const ok = await confirm({
    title: 'Registrar pago del saldo',
    message: `¿Registrar el pago del saldo de ${formatCop(order.balanceDue)}? El total es ${formatCop(order.total)} y el abono pagado es ${formatCop(order.depositPaid)}.`,
    confirmLabel: 'Registrar pago del saldo',
  });
  if (!ok) return;
  updatingId.value = order.id;
  try {
    await api.post(`/orders/${order.id}/balance-payment`);
    toast.success(`Saldo registrado — ${orderSku(order)}`);
    invalidateAdminCache(dataKey.value);
    invalidateAdminCachePrefix('admin-orders-');
    invalidateMoneyCaches();
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar el saldo.'));
  } finally {
    updatingId.value = null;
  }
}

function openEdit(order: OrderDto) {
  editingOrder.value = order;
}

function onEditSaved() {
  editingOrder.value = null;
  invalidateAdminCache(dataKey.value);
  invalidateAdminCachePrefix('admin-orders-');
  refresh();
}

useSeoMeta({ title: props.seoTitle });
</script>

<template>
  <div class="admin-records-page orders-page">
    <UiSectionHeader
      label="Ventas"
      :title="`${title} (${totalOrders})`"
    />
    <p class="admin-records-period-label">{{ periodLabel }}</p>

    <div class="admin-orders-search">
      <UiLuxInput
        v-model="searchInput"
        placeholder="Buscar por SKU, cliente o pedido..."
        @input="onSearchInput"
      />
      <p v-if="searchMiss" class="admin-search-empty" role="status">{{ searchMiss }}</p>
    </div>

    <div class="admin-records-toolbar">
      <UiAdminRefreshButton :loading="pending" @click="refresh()" />
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
            <span class="admin-order-money">
              <span class="admin-record-amount">Total: {{ formatCop(order.total) }}</span>
              <span class="admin-record-muted">Abono pagado: {{ formatCop(order.depositPaid ?? 0) }}</span>
              <span class="admin-record-muted">Falta por pagar: {{ formatCop(order.balanceDue ?? 0) }}</span>
            </span>
            <span class="admin-record-date">{{ formatDate(order.createdAt) }}</span>
            <span v-if="orderHasDeliveryNotes(order)" class="admin-delivery-note-badge">Nota entrega</span>
            <span v-if="isReceiptVoided(order)" class="admin-record-chip">Anulado</span>
            <span v-if="voidReasonText(order)" class="admin-record-muted">{{ voidReasonText(order) }}</span>
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
              <a
                v-if="order.customerWhatsappUrl"
                class="admin-record-btn"
                :href="order.customerWhatsappUrl"
                target="_blank"
                rel="noopener"
                @click.stop
              >
                Avisar por WhatsApp
              </a>
            </AdminAccordionSection>

            <AdminAccordionSection title="Pagos" :subtitle="`Falta por pagar: ${formatCop(order.balanceDue ?? 0)}`">
              <p>Total: {{ formatCop(order.total) }}</p>
              <p class="admin-record-muted">Abono pagado: {{ formatCop(order.depositPaid ?? 0) }}</p>
              <p class="admin-record-muted">Falta por pagar: {{ formatCop(order.balanceDue ?? 0) }}</p>
              <ul v-if="order.payments?.length" class="admin-record-list">
                <li v-for="payment in order.payments" :key="payment.id">
                  {{ payment.type === 'ABONO' ? 'Abono' : 'Saldo' }}: {{ formatCop(payment.amount) }}
                  <span v-if="payment.method">
                    · {{ PAYMENT_METHOD_LABELS[payment.method] ?? payment.method }}
                  </span>
                  · {{ formatDate(payment.paidAt) }}
                  <span v-if="payment.registeredByName"> · {{ payment.registeredByName }}</span>
                </li>
              </ul>
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
                  <button
                    v-if="item.watchThumbnail"
                    type="button"
                    class="admin-record-thumb"
                    :aria-label="`Ver imagen de ${item.productSku}`"
                    @click.stop="previewSrc = item.watchThumbnail"
                  >
                    <img
                      :src="item.watchThumbnail"
                      :alt="item.productName"
                      width="40"
                      height="40"
                    />
                  </button>
                  <span>
                    {{ item.productSku }} — {{ item.productName }} ×{{ item.quantity }}
                    <span class="admin-record-muted"> · {{ formatCop(item.unitPrice * item.quantity) }}</span>
                    <p v-if="item.deliveryNote?.trim()" class="admin-delivery-note">{{ item.deliveryNote }}</p>
                    <p v-if="formatOrderExtras(item)" class="admin-delivery-note">{{ formatOrderExtras(item) }}</p>
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
              v-if="orderHasDeliveryNotes(order)"
              title="Notas de entrega"
              subtitle="Ruta y horarios"
              :default-open="true"
            >
              <ul class="admin-record-list">
                <li v-for="entry in orderDeliveryNotes(order)" :key="entry.id" class="admin-delivery-note-item">
                  <strong>{{ entry.label }}</strong>
                  <p class="admin-delivery-note">{{ entry.note }}</p>
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

            <div class="admin-record-actions">
              <template v-if="canDownloadReceipt(order) || isReceiptVoided(order)">
                <button
                  type="button"
                  class="admin-record-btn"
                  :disabled="!canDownloadReceipt(order)"
                  @click.stop="downloadReceipt(order)"
                >
                  Descargar comprobante
                </button>
                <span v-if="order.receiptNumber" class="admin-record-muted">
                  N.º {{ order.receiptNumber }}
                </span>
                <span v-if="isReceiptVoided(order)" class="admin-record-chip">Anulado</span>
                <span v-if="voidReasonText(order)" class="admin-record-muted">{{ voidReasonText(order) }}</span>
                <p v-if="canDownloadReceipt(order)" class="admin-record-muted">Descárgalo y envíalo al cliente por WhatsApp.</p>
              </template>
              <button
                v-if="canVoidSale(order)"
                type="button"
                class="admin-record-btn admin-record-btn--danger"
                @click.stop="openVoid(order)"
              >
                Anular venta
              </button>
              <button
                v-if="canRegisterBalance(order)"
                type="button"
                class="admin-record-btn admin-record-btn--primary"
                :disabled="updatingId === order.id"
                @click.stop="registerBalance(order)"
              >
                Registrar pago del saldo
              </button>
              <template v-if="nextTransitions(order).length || hasPendingWarranty(order)">
                <label
                  v-if="nextTransitions(order).includes(OrderStatus.PAGADO)"
                  class="admin-record-muted"
                >
                  Método de pago
                  <select
                    class="admin-record-textarea"
                    :value="paymentMethodByOrder[order.id] ?? 'NO_ESPECIFICADO'"
                    @change.stop="
                      paymentMethodByOrder[order.id] = ($event.target as HTMLSelectElement)
                        .value as PaymentMethod
                    "
                  >
                    <option
                      v-for="option in paymentMethodOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
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
              </template>
              <button type="button" class="admin-record-btn admin-record-btn--ghost" @click.stop="openEdit(order)">
                Editar
              </button>
              <button
                type="button"
                class="admin-record-btn admin-record-btn--danger"
                :disabled="deletingId === order.id"
                @click.stop="deleteOrder(order)"
              >
                {{ deletingId === order.id ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>

            <p v-if="order.status === 'ENTREGADO'" class="admin-record-status-note">
              Pedido completado.
            </p>
          </div>
        </div>
      </article>

      <p v-if="!orders.length && !searchTerm" class="admin-record-empty">
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

  <div
    v-if="voidTarget"
    class="admin-modal-backdrop"
    @click.self="closeVoid"
  >
    <div class="admin-modal void-sale-modal" role="dialog" aria-modal="true" aria-labelledby="void-sale-title">
      <div class="void-sale-header">
        <h2 id="void-sale-title" class="admin-record-title">Anular venta</h2>
        <button type="button" class="void-sale-close" aria-label="Cerrar" :disabled="voidPending" @click="closeVoid">✕</button>
      </div>
      <div class="void-sale-body">
        <p class="admin-record-muted">{{ voidTarget.readableId }} · {{ voidTarget.customerName }}</p>
        <p class="void-sale-warning">
          Se repondrá el stock, el comprobante quedará anulado y un cierre de caja ya guardado de ese día no se recalculará.
        </p>
        <label class="void-sale-field">
          <span>Motivo de la anulación</span>
          <textarea
            v-model="voidReasonInput"
            class="admin-record-textarea"
            rows="4"
            maxlength="500"
            required
            placeholder="Describe por qué se anula esta venta"
          />
        </label>
        <p class="admin-record-muted">{{ voidReasonClean.length }}/500 · mínimo 5 caracteres</p>
      </div>
      <div class="admin-record-actions void-sale-footer">
        <button
          type="button"
          class="admin-record-btn admin-record-btn--danger"
          :disabled="voidPending || !voidReasonValid"
          @click="confirmVoid"
        >
          {{ voidPending ? 'Anulando...' : 'Anular venta' }}
        </button>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" :disabled="voidPending" @click="closeVoid">
          Volver
        </button>
      </div>
    </div>
  </div>

  <AdminOrderEditModal
    v-if="editingOrder"
    :order="editingOrder"
    @close="editingOrder = null"
    @saved="onEditSaved"
  />
  <AdminImageLightbox :src="previewSrc" @close="previewSrc = null" />
</template>

<style scoped>
.admin-order-money {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
}

.void-sale-modal {
  max-width: 480px;
}

.void-sale-header,
.void-sale-body,
.void-sale-footer {
  padding: 1.25rem 1.5rem;
}

.void-sale-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
}

.void-sale-body {
  display: grid;
  gap: 0.75rem;
}

.void-sale-warning {
  margin: 0;
  color: #e3b15a;
  font-size: 13px;
  line-height: 1.5;
}

.void-sale-field {
  display: grid;
  gap: 0.35rem;
}

.void-sale-field span {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #9ca3af);
}

.void-sale-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}

.void-sale-footer {
  border-top: 1px solid rgba(200, 169, 110, 0.15);
}
</style>

