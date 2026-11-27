<script setup lang="ts">
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['admin'], keepalive: true });

const auth = useAuthStore();
if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

const api = useApi();
const page = ref(1);
const channel = ref<'ALL' | 'LOCAL' | 'WEB'>('ALL');
const search = ref('');
const from = ref('');
const to = ref('');

type Row = {
  orderId: string;
  readableId: string;
  paidAt: string | null;
  channel: string;
  sellerName: string | null;
  customerName: string;
  image: string | null;
  watches: string;
  paymentMethods: string[];
  gross: number;
  discount: number;
  net: number;
  cost: number | null;
  profit: number | null;
  marginPercent: number | null;
  costStatus: 'MISSING' | 'ESTIMATED' | 'SNAPSHOT';
};

type Payload = {
  items: Row[];
  total: number;
  page: number;
  limit: number;
  totals: { gross: number; discount: number; net: number; cost: number; profit: number };
};

const dataKey = computed(
  () => `admin-ventas-todas-${page.value}-${channel.value}-${search.value}-${from.value}-${to.value}`,
);

const { data, pending, refresh } = useAdminCachedData(
  dataKey,
  () =>
    api.get<Payload>('/dashboards/sales', {
      channel: channel.value,
      page: page.value,
      limit: 25,
      search: search.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
    }),
  { watch: [dataKey] },
);

useLiveRefresh(() => refresh(), { intervalMs: 0 });

const rows = computed(() => data.value?.items ?? []);
const totals = computed(() => data.value?.totals);
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 25)));

function money(value: number | null | undefined) {
  if (value == null) return '—';
  return formatCop(value);
}

function when(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

useSeoMeta({ title: 'Todas las ventas — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records todas-ventas">
    <header class="admin-records-header">
      <h1>Todas las ventas</h1>
    </header>
    <div class="todas-filters">
      <button type="button" :class="{ active: channel === 'ALL' }" @click="channel = 'ALL'; page = 1">Total</button>
      <button type="button" :class="{ active: channel === 'LOCAL' }" @click="channel = 'LOCAL'; page = 1">Local</button>
      <button type="button" :class="{ active: channel === 'WEB' }" @click="channel = 'WEB'; page = 1">Web</button>
      <input v-model="search" type="search" placeholder="Buscar" @change="page = 1">
      <input v-model="from" type="date" @change="page = 1">
      <input v-model="to" type="date" @change="page = 1">
    </div>
    <div class="ventas-table-wrap">
      <table class="admin-table ventas-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Fecha</th>
            <th>Canal</th>
            <th>Vendedor</th>
            <th>Cliente</th>
            <th>Reloj</th>
            <th>Pago</th>
            <th>Bruto</th>
            <th>Desc.</th>
            <th>Neto</th>
            <th>Costo</th>
            <th>Ganancia</th>
            <th>Margen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending && !rows.length">
            <td colspan="13">Cargando...</td>
          </tr>
          <tr v-for="row in rows" :key="row.orderId">
            <td>
              <img v-if="row.image" :src="row.image" alt="" class="ventas-thumb" width="40" height="40">
              <span v-else class="ventas-thumb-placeholder">—</span>
            </td>
            <td>{{ when(row.paidAt) }}</td>
            <td>{{ row.channel === 'LOCAL' ? 'Local' : 'Web' }}</td>
            <td>{{ row.sellerName || '—' }}</td>
            <td>{{ row.customerName }}</td>
            <td>{{ row.watches }}</td>
            <td>{{ row.paymentMethods.join(', ') }}</td>
            <td>{{ money(row.gross) }}</td>
            <td>{{ money(row.discount) }}</td>
            <td>{{ money(row.net) }}</td>
            <td>
              {{ money(row.cost) }}
              <span v-if="row.costStatus === 'MISSING'" class="admin-record-chip">sin costo</span>
              <span v-else-if="row.costStatus === 'ESTIMATED'" class="admin-record-chip">estimado</span>
            </td>
            <td>{{ money(row.profit) }}</td>
            <td>{{ row.marginPercent == null ? '—' : `${row.marginPercent.toFixed(1)}%` }}</td>
          </tr>
          <tr v-if="totals" class="todas-totals">
            <td colspan="7">Totales del filtro</td>
            <td>{{ money(totals.gross) }}</td>
            <td>{{ money(totals.discount) }}</td>
            <td>{{ money(totals.net) }}</td>
            <td>{{ money(totals.cost) }}</td>
            <td>{{ money(totals.profit) }}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="totalPages > 1" class="admin-records-pagination">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1" @click="page -= 1">Anterior</button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="admin-records-page-btn" :disabled="page >= totalPages" @click="page += 1">Siguiente</button>
    </nav>
  </div>
</template>

<style scoped>
.todas-ventas {
  background: #fff;
  color: #1a1a1a;
  padding: 16px;
}
.todas-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.todas-filters button.active {
  border-color: #b8860b;
}
.todas-filters input,
.todas-filters button {
  background: #fff;
  border: 1px solid #ddd;
  padding: 8px 10px;
}
.ventas-table-wrap { overflow-x: auto; }
.ventas-table { width: 100%; border-collapse: collapse; background: #fff; }
.ventas-table th,
.ventas-table td {
  padding: 8px;
  border-bottom: 1px solid #eee;
  text-align: left;
  font-size: 0.82rem;
  white-space: nowrap;
}
.ventas-thumb { width: 40px; height: 40px; object-fit: cover; }
.todas-totals td { font-weight: 700; }
@media (max-width: 720px) {
  .todas-ventas { padding: 8px; }
}
</style>
