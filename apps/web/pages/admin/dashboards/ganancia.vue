<script setup lang="ts">
import type { ProfitDashboardDto } from '@luxtime/shared';
import type { ChartGranularity, ChartOrderInput } from '~/utils/chart-series';
import { formatCop } from '~/utils/format';
import { ADMIN_CACHE_MS } from '~/utils/admin-cache';

const AdminRevenueTrendChartLazy = defineAsyncComponent(() => import('~/components/admin/RevenueTrendChart.vue'));

definePageMeta({ middleware: ['admin'], keepalive: true });

const auth = useAuthStore();
const api = useApi();

if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

type ChartPeriod = 'day' | 'week' | 'month' | 'all';
type ChannelTab = 'LOCAL' | 'WEB' | 'ALL';
const chartPeriod = ref<ChartPeriod>('month');
const channel = ref<ChannelTab>('LOCAL');

const chartPeriods: { key: ChartPeriod; label: string }[] = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: '1 semana' },
  { key: 'month', label: '1 mes' },
  { key: 'all', label: 'Histórico' },
];

const granularity = computed<ChartGranularity>(() => {
  if (chartPeriod.value === 'day') return 'hour';
  if (chartPeriod.value === 'all') return 'month';
  return 'day';
});

type ProfitMetric = 'revenue' | 'profit' | 'net' | 'expenses';
const chartMetric = ref<ProfitMetric>('profit');
const metricOptions: { key: ProfitMetric; label: string }[] = [
  { key: 'revenue', label: 'Ventas netas' },
  { key: 'profit', label: 'Ganancia bruta' },
  { key: 'net', label: 'Ganancia neta' },
  { key: 'expenses', label: 'Gastos' },
];

const profitCacheKey = computed(() => `profit-dashboard-${chartPeriod.value}-${channel.value}`);

const { data: dashboard, refresh, pending } = useAdminCachedData(
  profitCacheKey,
  () => api.get<ProfitDashboardDto>(`/dashboards/profit?period=${chartPeriod.value}&channel=${channel.value}`),
  { staleTime: ADMIN_CACHE_MS.dashboards, watch: [chartPeriod, channel] },
);

useLiveRefresh(() => refresh(), { intervalMs: 0 });

const kpis = computed(() => {
  const data = dashboard.value;
  if (!data) return [];
  return [
    { key: 'gross', label: 'Ventas brutas', value: formatCop(data.grossSales ?? 0), subtitle: 'Precio de lista del periodo' },
    { key: 'discount', label: 'Descuentos', value: formatCop(data.discounts ?? 0), subtitle: 'No reducen el costo' },
    { key: 'net', label: 'Ventas netas', value: formatCop(data.netSales ?? data.totalRevenue), subtitle: 'Facturado sin domicilios' },
    { key: 'cost', label: 'Costo de mercancía', value: formatCop(data.totalCost), subtitle: 'Solo líneas con costo' },
    { key: 'grossProfit', label: 'Ganancia bruta', value: formatCop(data.totalGrossProfit), subtitle: data.marginPercent == null ? 'Sin margen' : `Margen ${data.marginPercent.toFixed(1)}%` },
    { key: 'expenses', label: 'Gastos del canal', value: formatCop(data.operatingExpenses ?? 0), subtitle: 'Sin categoría nómina' },
    { key: 'profit', label: 'Ganancia neta', value: formatCop(data.totalProfit), subtitle: 'Bruta − gastos del canal' },
    { key: 'units', label: 'Unidades', value: String(data.units ?? 0), subtitle: `Ticket ${formatCop(data.averageTicket ?? 0)}` },
    { key: 'reinvestment', label: 'Fondo de reinversión', value: formatCop(data.totalReinvestmentFund), subtitle: `${data.reinvestmentPercent}% de la ganancia neta` },
    { key: 'owner', label: 'Ganancia libre del dueño', value: formatCop(data.totalOwnerProfit), subtitle: `${data.ownerProfitPercent}% de la ganancia neta` },
    { key: 'shipping', label: 'Domicilios', value: formatCop(data.totalShippingRevenue), subtitle: channel.value === 'LOCAL' ? 'El local no cobra domicilio' : 'Ingreso de entregas, aparte de la ganancia' },
    { key: 'inventory', label: 'Inversión en inventario', value: formatCop(data.totalInventoryInvestment), subtitle: 'Costo del stock actual' },
  ];
});

const ordersByMetric = computed<ChartOrderInput[]>(() => {
  const items = dashboard.value?.items ?? [];
  const grouped = new Map<string, { paidAt: string; readableId: string; total: number }>();
  for (const item of items) {
    const value = chartMetric.value === 'revenue'
      ? item.revenue
      : chartMetric.value === 'expenses'
        ? 0
        : item.profit;
    const entry = grouped.get(item.orderId) ?? { paidAt: item.paidAt, readableId: item.readableId, total: 0 };
    entry.total += value;
    grouped.set(item.orderId, entry);
  }
  if (chartMetric.value === 'net' && dashboard.value) {
    const expense = dashboard.value.operatingExpenses ?? 0;
    if (grouped.size && expense) {
      const first = grouped.values().next().value;
      if (first) first.total -= expense;
    }
  }
  return [...grouped.entries()].map(([orderId, entry]) => ({
    id: orderId,
    at: entry.paidAt,
    amount: entry.total,
    sku: entry.readableId,
  }));
});

const rangeStart = computed<number | null>(() => {
  const from = dashboard.value?.rangeFrom;
  return from ? new Date(from).getTime() : null;
});

const methodLabels: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DATAFONO_BOLD: 'Datáfono',
  NO_ESPECIFICADO: 'No especificado',
};

type ExportPeriod = 'day' | 'week' | 'month';
const exportPeriod = ref<ExportPeriod>('day');
const exportPeriods: { key: ExportPeriod; label: string }[] = [
  { key: 'day', label: 'Diario' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensual' },
];
const exporting = ref<'pdf' | 'excel' | null>(null);

async function exportReport(type: 'pdf' | 'excel') {
  exporting.value = type;
  try {
    const config = useRuntimeConfig();
    const endpoint = type === 'pdf' ? 'profit/export/pdf' : 'profit/export/excel';
    window.open(
      `${config.public.apiBaseUrl}/dashboards/${endpoint}?period=${exportPeriod.value}&channel=${channel.value}`,
      '_blank',
    );
  } finally {
    window.setTimeout(() => {
      exporting.value = null;
    }, 800);
  }
}

function costLabel(status?: string) {
  if (status === 'MISSING') return 'sin costo';
  if (status === 'ESTIMATED') return 'estimado';
  return '';
}

useSeoMeta({ title: 'Dashboard de Ganancia — LUXTIMEE Admin' });
</script>

<template>
  <div class="health-dashboard ganancia-page">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Ganancia</h1>
        <p class="health-dashboard-subtitle">Horario America/Bogota. Local es POS. Web incluye WhatsApp, mayorista y especiales.</p>
      </div>
    </header>

    <div class="health-chart-toggle ganancia-tabs">
      <button type="button" :class="{ active: channel === 'LOCAL' }" @click="channel = 'LOCAL'">Local</button>
      <button type="button" :class="{ active: channel === 'WEB' }" @click="channel = 'WEB'">Web</button>
      <button type="button" :class="{ active: channel === 'ALL' }" @click="channel = 'ALL'">Total</button>
    </div>

    <section v-if="dashboard?.missingCostCount" class="health-table-card">
      <h3>Ganancia incompleta</h3>
      <p>{{ dashboard.missingCostCount }} líneas y {{ formatCop(dashboard.missingCostRevenue ?? 0) }} en ventas sin costo. No entran en costo, ganancia ni margen.</p>
      <ul>
        <li v-for="item in dashboard.missingCostItems" :key="`${item.orderId}-${item.productSku}`">
          {{ item.readableId }} · {{ item.productName }} · {{ item.quantity }} u · {{ formatCop(item.revenue) }}
        </li>
      </ul>
      <NuxtLink to="/admin/pending-info?section=cost">Pendientes de info > costo</NuxtLink>
    </section>

    <section v-if="dashboard?.payroll" class="health-table-card">
      <h3>Fondo de nómina y mantenimiento (mes calendario)</h3>
      <p>
        Fondo {{ formatCop(dashboard.payroll.fund) }} ({{ dashboard.payroll.fundPercent }}% de {{ formatCop(dashboard.payroll.invoiced) }} facturados).
        Este canal aporta {{ formatCop(dashboard.payroll.channelFund) }}.
        Nómina {{ formatCop(dashboard.payroll.payroll) }}.
        {{ dashboard.payroll.surplus >= 0 ? 'Excedente' : 'Faltante' }} {{ formatCop(Math.abs(dashboard.payroll.surplus)) }}.
        % necesario {{ dashboard.payroll.neededPercent == null ? '—' : dashboard.payroll.neededPercent.toFixed(1) + '%' }}.
        Ventas para cubrir {{ dashboard.payroll.salesToCover == null ? '—' : formatCop(dashboard.payroll.salesToCover) }}.
      </p>
      <p>Gastos categoría nómina del periodo: {{ formatCop(dashboard.payroll.payrollExpensesPaid) }}. No se restan otra vez en la ganancia neta.</p>
    </section>

    <div v-if="pending && !dashboard" class="health-kpi-grid">Cargando...</div>
    <div v-else class="health-kpi-grid health-kpi-grid--six">
      <article v-for="kpi in kpis" :key="kpi.key" class="health-kpi-card">
        <p class="health-kpi-label">{{ kpi.label }}</p>
        <p class="health-kpi-value">{{ kpi.value }}</p>
        <p class="health-kpi-subtitle">{{ kpi.subtitle }}</p>
      </article>
    </div>

    <section class="health-table-card">
      <h3>Top relojes</h3>
      <p v-for="row in dashboard?.topWatches ?? []" :key="row.label">{{ row.label }} · {{ row.units }} u · {{ formatCop(row.profit) }}</p>
      <h3>Top marcas</h3>
      <p v-for="row in dashboard?.topBrands ?? []" :key="row.label">{{ row.label }} · {{ row.units }} u · {{ formatCop(row.profit) }}</p>
      <h3>Métodos de pago</h3>
      <p v-for="row in dashboard?.paymentMethods ?? []" :key="row.method">{{ methodLabels[row.method] ?? row.method }} · {{ formatCop(row.amount) }}</p>
    </section>

    <div class="health-main-grid health-main-grid--single">
      <AdminRevenueTrendChartLazy
        title="Ganancia"
        :ranges="chartPeriods"
        :range="chartPeriod"
        :granularity="granularity"
        :orders="ordersByMetric"
        :from="rangeStart"
        :loading="pending"
        color="#D4AF37"
        :metric-options="metricOptions"
        :metric="chartMetric"
        @update:range="chartPeriod = $event as ChartPeriod"
        @update:metric="chartMetric = $event as ProfitMetric"
        @retry="refresh()"
      />
    </div>

    <section class="health-table-card">
      <div class="health-table-header"><h3>Líneas</h3></div>
      <table class="health-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Fecha</th>
            <th>Reloj</th>
            <th>Bruto</th>
            <th>Desc.</th>
            <th>Neto</th>
            <th>Costo</th>
            <th>Ganancia</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in dashboard?.items ?? []" :key="`${item.orderId}-${item.productName}`">
            <td>{{ item.readableId }}</td>
            <td>{{ new Date(item.paidAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }}</td>
            <td>
              {{ item.productName }}
              <span v-if="costLabel(item.costStatus)" class="health-kpi-badge">{{ costLabel(item.costStatus) }}</span>
            </td>
            <td>{{ formatCop(item.gross ?? item.revenue) }}</td>
            <td>{{ formatCop(item.discount ?? 0) }}</td>
            <td>{{ formatCop(item.revenue) }}</td>
            <td>{{ item.costStatus === 'MISSING' ? '—' : formatCop(item.cost) }}</td>
            <td>{{ item.costStatus === 'MISSING' ? '—' : formatCop(item.profit) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="health-table-card health-export-card">
      <div class="health-chart-toggle">
        <button v-for="period in exportPeriods" :key="period.key" type="button" :class="{ active: exportPeriod === period.key }" @click="exportPeriod = period.key">
          {{ period.label }}
        </button>
      </div>
      <button type="button" class="health-export-btn" :disabled="!!exporting" @click="exportReport('pdf')">PDF</button>
      <button type="button" class="health-export-btn" :disabled="!!exporting" @click="exportReport('excel')">Excel</button>
    </section>
  </div>
</template>

<style scoped>
.ganancia-page { background: #fff; }
.ganancia-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.health-table-wrap, .health-table { background: #fff; }
@media (max-width: 720px) {
  .health-kpi-grid { grid-template-columns: 1fr; }
}
</style>
