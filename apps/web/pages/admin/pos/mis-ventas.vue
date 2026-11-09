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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));
const isAdmin = computed(() => auth.isStaff || auth.isSuperAdmin);

async function load() {
  pending.value = true;
  try {
    const data = await api.get<{
      items: PosMySaleDto[];
      total: number;
      page: number;
      limit: number;
    }>('/pos/my-sales', {
      date: date.value,
      page: page.value,
      limit,
      sellerId: isAdmin.value && sellerId.value ? sellerId.value : undefined,
    });
    items.value = data.items;
    total.value = data.total;
    page.value = data.page;
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar las ventas.'));
  } finally {
    pending.value = false;
  }
}

function downloadReceipt(sale: PosMySaleDto) {
  if (!sale.receiptId || sale.receiptVoided) {
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
            <span class="admin-record-date">{{ formatWhen(sale.createdAt) }}</span>
            <span class="admin-record-muted">{{ sale.methods.join(' · ') || 'Sin método' }}</span>
            <span v-if="sale.sellerName" class="admin-record-muted">{{ sale.sellerName }}</span>
            <span v-if="sale.receiptNumber" class="admin-record-muted">
              {{ sale.receiptVoided ? 'Anulado' : sale.receiptNumber }}
            </span>
          </div>
          <div class="admin-record-summary-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              :disabled="!sale.receiptId || sale.receiptVoided"
              @click="downloadReceipt(sale)"
            >
              Descargar comprobante
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
</style>
