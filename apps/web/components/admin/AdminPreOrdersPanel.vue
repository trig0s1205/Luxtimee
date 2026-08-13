<script setup lang="ts">
import type { OrderDto, PreOrdersListDto } from '@luxtime/shared';
import { PRE_ORDER_RESPONSE_HOURS } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { orderDeliveryNotes, orderHasDeliveryNotes } from '~/utils/order-delivery-notes';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';

const props = defineProps<{
  bucket: 'active' | 'suspended';
  title: string;
  seoTitle: string;
}>();

const PAGE_SIZE = 10;
const api = useApi();
const { confirm: confirmDialog } = useConfirm();
const { waitHoursSince } = useLiveWaitHours();
const page = ref(1);
const expandedIds = ref<Set<string>>(new Set());

const endpoint = computed(() =>
  props.bucket === 'active' ? '/pre-orders' : '/pre-orders/suspended',
);

const emptyList: PreOrdersListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
};

const cacheKey = computed(() => `admin-pre-orders-${props.bucket}-${page.value}`);

const { data: list, refresh, pending } = useAdminCachedData(
  cacheKey,
  () => api.get<PreOrdersListDto>(endpoint.value, { page: page.value, limit: PAGE_SIZE }).catch(() => emptyList),
  { watch: [cacheKey] },
);

const preOrders = computed(() => list.value?.items ?? []);
const total = computed(() => list.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function hoursRemaining(order: OrderDto) {
  return Math.max(0, PRE_ORDER_RESPONSE_HOURS - waitHoursSince(order.preOrderActiveAt));
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

async function confirmDeposit(id: string) {
  const ok = await confirmDialog({
    title: 'Confirmar abono',
    message: '¿Confirmas que el cliente realizó el abono y deseas convertir este pre-pedido en pedido?',
    confirmLabel: 'Confirmar abono',
  });
  if (!ok) return;
  await api.post(`/pre-orders/${id}/confirm-deposit`);
  invalidateAdminCache(cacheKey.value);
  invalidateAdminCachePrefix('admin-orders-');
  invalidateAdminCachePrefix('profit-dashboard-');
  await refresh();
}

async function reactivate(id: string) {
  const ok = await confirmDialog({
    title: 'Reactivar pre-pedido',
    message: 'El cliente volvió a escribir. ¿Reactivar este pre-pedido por 24 horas más?',
    confirmLabel: 'Reactivar',
  });
  if (!ok) return;
  await api.post(`/pre-orders/${id}/reactivate`);
  invalidateAdminCache(cacheKey.value);
  await refresh();
}

async function cancelOrder(id: string) {
  const ok = await confirmDialog({
    title: 'Anular pre-pedido',
    message: '¿Anular este pre-pedido? Esta acción no se puede deshacer.',
    confirmLabel: 'Anular',
    destructive: true,
  });
  if (!ok) return;
  await api.post(`/pre-orders/${id}/cancel`);
  invalidateAdminCache(cacheKey.value);
  await refresh();
}

useSeoMeta({ title: props.seoTitle });
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader
      label="Ventas"
      :title="`${title} (${total})`"
      refreshable
      :refreshing="pending"
      @refresh="refresh()"
    />

    <p v-if="bucket === 'active'" class="admin-records-hint">
      Pre-pedidos vigentes durante {{ PRE_ORDER_RESPONSE_HOURS }} horas. Si el cliente no responde, pasan automáticamente a suspendidos.
    </p>
    <p v-else class="admin-records-hint">
      Clientes que dejaron de responder por más de {{ PRE_ORDER_RESPONSE_HOURS }} horas. Puedes reactivarlos si vuelven a escribir.
    </p>

    <div class="admin-records-actions mb-4">
      <NuxtLink to="/admin/pre-pedidos/nuevo" class="admin-record-btn admin-record-btn--primary">
        Nuevo pre-pedido manual
      </NuxtLink>
    </div>

    <div v-if="pending && !preOrders.length" class="admin-record-empty">Cargando...</div>

    <div v-else class="admin-records-list">
      <article
        v-for="order in preOrders"
        :key="order.id"
        class="admin-record-card"
        :class="{ 'admin-record-card--open': isExpanded(order.id), 'opacity-80': bucket === 'suspended' }"
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
              <span class="admin-record-title">{{ order.readableId }}</span>
              <span class="admin-record-subtitle">{{ order.customerName }}</span>
            </div>
          </div>

          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(order.total) }}</span>
            <span class="admin-record-date">
              {{ bucket === 'active' ? `${hoursRemaining(order)}h restantes` : `Suspendido ${waitHoursSince(order.suspendedAt ?? order.preOrderActiveAt)}h` }}
            </span>
            <span v-if="orderHasDeliveryNotes(order)" class="admin-delivery-note-badge">Nota entrega</span>
          </div>

          <div class="admin-record-summary-actions" @click.stop>
            <AdminTagMenu :label="order.type === 'MAYORISTA' ? 'Mayorista' : 'Detal'">
              <UiLuxBadge :tone="order.type === 'MAYORISTA' ? 'mayorista' : 'detal'">
                {{ order.type }}
              </UiLuxBadge>
              <UiLuxBadge :tone="bucket === 'suspended' ? 'cancelado' : 'pendiente'">
                {{ bucket === 'active' ? 'Activo' : 'Suspendido' }}
              </UiLuxBadge>
              <UiLuxBadge v-if="order.source === 'WHATSAPP'" tone="mayorista">WhatsApp</UiLuxBadge>
            </AdminTagMenu>
          </div>
        </button>

        <div v-show="isExpanded(order.id)" class="admin-record-details">
          <div class="admin-record-details-inner">
            <AdminAccordionSection title="Cliente" :subtitle="order.customerName">
              <p>{{ order.customerName }}</p>
              <p class="admin-record-muted">{{ order.customerPhone || 'Sin teléfono' }}</p>
              <p class="admin-record-muted">{{ order.customerAddress }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection title="Montos" :subtitle="formatCop(order.total)">
              <p>Total: {{ formatCop(order.total) }}</p>
              <p class="admin-record-muted">Abono esperado: {{ formatCop(order.depositExpected) }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection
              title="Productos"
              :subtitle="`${order.items.length} artículo${order.items.length === 1 ? '' : 's'}`"
            >
              <ul class="admin-record-list">
                <li v-for="item in order.items" :key="item.id">
                  {{ item.productName }} ×{{ item.quantity }}
                  <p v-if="item.deliveryNote?.trim()" class="admin-delivery-note">
                    {{ item.deliveryNote }}
                  </p>
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
              title="Tiempo"
              :subtitle="bucket === 'active' ? `${hoursRemaining(order)}h restantes` : 'Suspendido'"
            >
              <p v-if="bucket === 'active'" class="admin-record-muted">
                Vigente · {{ hoursRemaining(order) }}h restantes de {{ PRE_ORDER_RESPONSE_HOURS }}h
              </p>
              <p v-else class="admin-record-muted">
                Suspendido hace {{ waitHoursSince(order.suspendedAt ?? order.preOrderActiveAt) }}h
              </p>
            </AdminAccordionSection>

            <div class="admin-record-actions">
              <button
                v-if="bucket === 'active'"
                type="button"
                class="admin-record-btn admin-record-btn--primary"
                @click.stop="confirmDeposit(order.id)"
              >
                Confirmar abono
              </button>
              <button
                v-else
                type="button"
                class="admin-record-btn admin-record-btn--primary"
                @click.stop="reactivate(order.id)"
              >
                Reactivar
              </button>
              <button type="button" class="admin-record-btn admin-record-btn--ghost" @click.stop="cancelOrder(order.id)">
                Anular
              </button>
            </div>
          </div>
        </div>
      </article>

      <p v-if="!preOrders.length" class="admin-record-empty">
        {{ bucket === 'active' ? 'No hay pre-pedidos activos.' : 'No hay pre-pedidos suspendidos.' }}
      </p>
    </div>

    <nav v-if="totalPages > 1" class="admin-records-pagination" aria-label="Paginación de pre-pedidos">
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
