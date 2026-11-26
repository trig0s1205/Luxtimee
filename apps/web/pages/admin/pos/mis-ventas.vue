<script setup lang="ts">
import type { PosMySaleDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['admin'] });
useSeoMeta({ title: 'Mis ventas — LUXTIMEE Admin' });

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const config = useRuntimeConfig();

const date = ref(bogotaToday());
const sellerId = ref('');
const page = ref(1);
const limit = 25;
const pending = ref(false);
const items = ref<PosMySaleDto[]>([]);
const total = ref(0);
const voidedCount = ref(0);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));
const isAdmin = computed(() => auth.isStaff || auth.isSuperAdmin);
const voidTarget = ref<PosMySaleDto | null>(null);
const voidReason = ref('');
const voidPending = ref(false);
const hideTarget = ref<PosMySaleDto | null>(null);
const hidePending = ref(false);
const bulkHideOpen = ref(false);
const bulkHidePending = ref(false);

function sameBogotaDay(iso: string) {
  const saleDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return saleDay === bogotaToday();
}

function canVoid(sale: PosMySaleDto) {
  if (isVoided(sale)) return false;
  if (isAdmin.value) return true;
  return sale.sellerId === auth.user?.id && sameBogotaDay(sale.createdAt);
}

async function load() {
  pending.value = true;
  try {
    const data = await api.get<{
      items: PosMySaleDto[];
      total: number;
      page: number;
      limit: number;
      voidedCount: number;
    }>('/pos/my-sales', {
      date: date.value,
      page: page.value,
      limit,
      sellerId: isAdmin.value && sellerId.value ? sellerId.value : undefined,
    });
    items.value = data.items;
    total.value = data.total;
    voidedCount.value = data.voidedCount ?? 0;
    page.value = data.page;
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar las ventas.'));
  } finally {
    pending.value = false;
  }
}

function isVoided(sale: PosMySaleDto) {
  return sale.receiptVoided || Boolean(sale.receipt?.voidedAt);
}

async function confirmVoid() {
  if (!voidTarget.value || voidReason.value.trim().length < 5) return;
  voidPending.value = true;
  try {
    await api.post(`/pos/sales/${voidTarget.value.id}/void`, {
      reason: voidReason.value.trim(),
    });
    toast.success('Venta anulada.');
    voidTarget.value = null;
    voidReason.value = '';
    await load();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo anular la venta.'));
  } finally {
    voidPending.value = false;
  }
}

function dropHidden(id: string) {
  const next = items.value.filter((sale) => sale.id !== id);
  if (next.length === items.value.length) return;
  items.value = next;
  total.value = Math.max(0, total.value - 1);
  voidedCount.value = Math.max(0, voidedCount.value - 1);
}

async function confirmHide() {
  if (!hideTarget.value) return;
  const id = hideTarget.value.id;
  hidePending.value = true;
  try {
    await api.post(`/pos/sales/${id}/hide`);
    hideTarget.value = null;
    dropHidden(id);
    toast.success('Venta eliminada de Mis ventas.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar la venta.'));
  } finally {
    hidePending.value = false;
  }
}

async function confirmBulkHide() {
  bulkHidePending.value = true;
  try {
    const result = await api.post<{ hidden: number }>('/pos/sales/hide-voided', {
      date: date.value,
      sellerId: isAdmin.value && sellerId.value ? sellerId.value : undefined,
    });
    bulkHideOpen.value = false;
    items.value = items.value.filter((sale) => !isVoided(sale));
    total.value = Math.max(0, total.value - result.hidden);
    voidedCount.value = 0;
    toast.success('Ventas anuladas eliminadas de Mis ventas.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron eliminar las ventas.'));
  } finally {
    bulkHidePending.value = false;
  }
}

function downloadReceipt(sale: PosMySaleDto) {
  if (!sale.receiptId || isVoided(sale)) {
    toast.warning('Esta venta no tiene comprobante disponible.');
    return;
  }
  window.open(
    `${config.public.apiBaseUrl}/receipts/${sale.receiptId}/pdf`,
    '_blank',
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function onDateChange() {
  page.value = 1;
  void load();
}

watch(page, () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader label="Punto de venta" :title="`Mis ventas (${total})`" />

    <div class="admin-orders-search pos-sales-toolbar">
      <label class="pos-sales-field">
        <span>Fecha</span>
        <input v-model="date" type="date" class="admin-input" @change="onDateChange">
      </label>
      <label v-if="isAdmin" class="pos-sales-field">
        <span>Vendedor (id)</span>
        <input
          v-model="sellerId"
          class="admin-input"
          placeholder="Opcional"
          @change="onDateChange"
        >
      </label>
      <button type="button" class="admin-record-btn admin-record-btn--ghost" :disabled="pending" @click="load">
        Actualizar
      </button>
      <button
        v-if="isAdmin && voidedCount > 0"
        type="button"
        class="admin-record-btn admin-record-btn--danger"
        @click="bulkHideOpen = true"
      >
        Eliminar todas las anuladas
      </button>
    </div>

    <div v-if="pending && !items.length" class="admin-record-empty">Cargando ventas…</div>

    <div v-else class="admin-records-list">
      <article v-for="sale in items" :key="sale.id" class="admin-record-card">
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ sale.readableId }}</span>
              <span class="admin-record-subtitle">{{ sale.customerName }}</span>
            </div>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(sale.total) }}</span>
            <span v-if="sale.discountAmount" class="admin-record-muted">Descuento {{ formatCop(sale.discountAmount) }}</span>
            <span class="admin-record-date">{{ formatWhen(sale.createdAt) }}</span>
            <span class="admin-record-muted">{{ sale.methods.join(' · ') || 'Sin método' }}</span>
            <span v-if="sale.sellerName" class="admin-record-muted">{{ sale.sellerName }}</span>
            <span v-if="isVoided(sale)" class="admin-record-chip">Anulado</span>
            <span v-if="sale.receipt?.voidReason" class="admin-record-muted">{{ sale.receipt.voidReason }}</span>
            <span v-if="sale.receiptNumber" class="admin-record-muted">{{ sale.receiptNumber }}</span>
          </div>
          <div class="admin-record-summary-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              :disabled="!sale.receiptId || isVoided(sale)"
              @click="downloadReceipt(sale)"
            >
              Descargar comprobante
            </button>
            <button
              v-if="canVoid(sale)"
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              @click="voidTarget = sale"
            >
              Anular
            </button>
            <button
              v-if="isAdmin && isVoided(sale)"
              type="button"
              class="admin-record-btn admin-record-btn--danger"
              @click="hideTarget = sale"
            >
              Eliminar
            </button>
          </div>
        </div>
      </article>
      <p v-if="!items.length" class="admin-record-empty">No hay ventas para esta fecha.</p>
    </div>

    <nav v-if="totalPages > 1" class="admin-records-pagination" aria-label="Paginación de ventas">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1 || pending" @click="page--">
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="admin-records-page-btn" :disabled="page >= totalPages || pending" @click="page++">
        Siguiente
      </button>
    </nav>

    <div v-if="voidTarget" class="admin-modal-backdrop" @click.self="voidTarget = null">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <h2 class="admin-record-title">Anular venta</h2>
        <p class="admin-record-muted">{{ voidTarget.readableId }} · se repone el stock</p>
        <textarea v-model="voidReason" class="admin-record-textarea" rows="3" maxlength="500" placeholder="Motivo (mínimo 5 caracteres)" />
        <div class="admin-record-actions">
          <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="voidTarget = null">Cancelar</button>
          <button type="button" class="admin-record-btn admin-record-btn--primary" :disabled="voidReason.trim().length < 5 || voidPending" @click="confirmVoid">
            {{ voidPending ? 'Anulando…' : 'Anular' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="hideTarget" class="admin-modal-backdrop" @click.self="hideTarget = null">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <h2 class="admin-record-title">Eliminar venta</h2>
        <p class="admin-record-muted">¿Eliminar esta venta anulada? Ya no aparecerá en Mis ventas.</p>
        <div class="admin-record-actions">
          <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="hideTarget = null">Cancelar</button>
          <button type="button" class="admin-record-btn admin-record-btn--danger" :disabled="hidePending" @click="confirmHide">
            {{ hidePending ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="bulkHideOpen" class="admin-modal-backdrop" @click.self="bulkHideOpen = false">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <h2 class="admin-record-title">Eliminar ventas anuladas</h2>
        <p class="admin-record-muted">¿Eliminar las {{ voidedCount }} ventas anuladas? Ya no aparecerán en Mis ventas.</p>
        <div class="admin-record-actions">
          <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="bulkHideOpen = false">Cancelar</button>
          <button type="button" class="admin-record-btn admin-record-btn--danger" :disabled="bulkHidePending" @click="confirmBulkHide">
            {{ bulkHidePending ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-sales-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}

.pos-sales-field {
  display: grid;
  gap: 0.35rem;
}

.pos-sales-field span {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #9ca3af);
}

.pos-sales-field .admin-input {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 700px) {
  .pos-sales-toolbar,
  .pos-sales-field,
  .admin-record-summary,
  .admin-record-summary-actions {
    min-width: 0;
    max-width: 100%;
  }

  .pos-sales-field {
    flex: 1 1 100%;
  }

  .admin-record-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-record-summary-actions {
    justify-content: flex-start;
  }

  .admin-record-summary-actions .admin-record-btn {
    max-width: 100%;
    white-space: normal;
  }
}
</style>
