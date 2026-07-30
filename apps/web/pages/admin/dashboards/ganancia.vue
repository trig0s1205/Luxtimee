<script setup lang="ts">
import type { ProfitDashboardDto } from '@luxtime/shared';
import type { ChartGranularity, ChartOrderInput } from '~/utils/chart-series';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
const api = useApi();

if (!auth.loaded) {
  await auth.fetchMe();
}
if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

type ChartPeriod = 'day' | 'week' | 'month' | 'all';
const chartPeriod = ref<ChartPeriod>('month');

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

type ProfitMetric = 'profit' | 'commission';
const chartMetric = ref<ProfitMetric>('profit');

const metricOptions: { key: ProfitMetric; label: string }[] = [
  { key: 'profit', label: 'Ganancia neta' },
  { key: 'commission', label: 'Comisión secretaría' },
];

const chartTitle = computed(() =>
  chartMetric.value === 'commission' ? 'COMISIÓN SECRETARÍA' : 'GANANCIA NETA',
);

const { data: dashboard, refresh, pending } = await useAsyncData(
  'profit-dashboard',
  () => api.get<ProfitDashboardDto>(`/dashboards/profit?period=${chartPeriod.value}`),
  { watch: [chartPeriod] },
);

const kpis = computed(() => {
  const data = dashboard.value;
  if (!data) return [];

  return [
    {
      key: 'revenue',
      label: 'Ingresos',
      value: formatCop(data.totalRevenue),
      subtitle: `Periodo: ${data.period}`,
      highlight: 'gold' as const,
      badge: null,
    },
    {
      key: 'profit',
      label: 'Ganancia neta',
      value: formatCop(data.totalProfit),
      subtitle: `Ingresos − costos − comisión (${data.totalCommission ? formatCop(data.totalCommission) : '$0'})`,
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'commission',
      label: 'Comisión secretaría',
      value: formatCop(data.totalCommission),
      subtitle: `${data.commissionPercent}% sobre el margen bruto vendido`,
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'reinvestment',
      label: 'Fondo de reinversión',
      value: formatCop(data.totalReinvestmentFund),
      subtitle: `${data.reinvestmentPercent}% de la ganancia neta · ahorro para relojería`,
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'owner',
      label: 'Ganancia libre del dueño',
      value: formatCop(data.totalOwnerProfit),
      subtitle: `${data.ownerProfitPercent}% de la ganancia neta · margen libre`,
      highlight: 'gold' as const,
      badge: null,
    },
    {
      key: 'inventory',
      label: 'Inversión en inventario',
      value: formatCop(data.totalInventoryInvestment),
      subtitle: 'Costo total del stock actual en catálogo',
      highlight: 'white' as const,
      badge: null,
    },
  ];
});

const orderTypeLabels: Record<string, string> = {
  DETAL: 'Al detal',
  MAYORISTA: 'Mayorista',
};

const orderStatusLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
};

const activityRows = computed(() =>
  (dashboard.value?.items ?? []).map((item) => ({
    id: `${item.orderId}-${item.productName}`,
    orderId: item.readableId,
    date: new Date(item.paidAt).toLocaleDateString('es-CO'),
    type: orderTypeLabels[item.orderType] ?? item.orderType,
    watch: item.productName,
    status: orderStatusLabels[item.orderStatus] ?? item.orderStatus,
    cost: formatCop(item.cost),
    profit: formatCop(item.profit),
    commission: formatCop(item.commission),
    commissionPercent: `${item.commissionPercent}%`,
  })),
);

const ordersByMetric = computed<ChartOrderInput[]>(() => {
  const items = dashboard.value?.items ?? [];
  const grouped = new Map<string, { paidAt: string; readableId: string; total: number; products: string[] }>();

  for (const item of items) {
    const value = Number(chartMetric.value === 'commission' ? item.commission : item.profit);
    if (!Number.isFinite(value)) continue;

    const entry = grouped.get(item.orderId) ?? {
      paidAt: item.paidAt,
      readableId: item.readableId,
      total: 0,
      products: [],
    };
    entry.total += value;
    entry.products.push(item.productName);
    grouped.set(item.orderId, entry);
  }

  return [...grouped.entries()].map(([orderId, entry]) => ({
    id: orderId,
    at: entry.paidAt,
    amount: entry.total,
    sku: entry.readableId,
  }));
});

// Debe coincidir con periodStart() del backend para que el eje X no se corte.
const rangeStart = computed<number | null>(() => {
  const now = new Date();
  if (chartPeriod.value === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (chartPeriod.value === 'week') return now.getTime() - 7 * 86400000;
  if (chartPeriod.value === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return null;
});

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
    window.open(`${config.public.apiBaseUrl}/dashboards/${endpoint}?period=${exportPeriod.value}`, '_blank');
  } finally {
    window.setTimeout(() => {
      exporting.value = null;
    }, 800);
  }
}

useSeoMeta({ title: 'Dashboard de Ganancia — Luxtime Admin' });
</script>

<template>
  <div class="health-dashboard">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Dashboard de Ganancia (Super Admin)</h1>
        <p class="health-dashboard-subtitle">Desglose financiero y comisiones de secretaría</p>
      </div>
    </header>

    <section class="health-table-card health-export-card">
      <div class="health-table-header">
        <h3>Exportar reporte</h3>
      </div>
      <p class="health-export-hint">
        Los reportes en PDF y Excel incluyen los datos de contacto del Super Admin registrados en Configuración.
        El histórico no se puede exportar por su volumen de datos: elige diario, semanal o mensual.
      </p>
      <div class="health-export-controls">
        <div class="health-chart-toggle">
          <button
            v-for="period in exportPeriods"
            :key="period.key"
            type="button"
            :class="{ active: exportPeriod === period.key }"
            @click="exportPeriod = period.key"
          >
            {{ period.label }}
          </button>
        </div>
        <div class="health-header-actions">
          <button type="button" class="health-export-btn" :disabled="exporting === 'pdf'" @click="exportReport('pdf')">
            {{ exporting === 'pdf' ? 'Generando...' : 'Exportar PDF' }}
          </button>
          <button type="button" class="health-export-btn" :disabled="exporting === 'excel'" @click="exportReport('excel')">
            {{ exporting === 'excel' ? 'Generando...' : 'Exportar Excel' }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="pending" class="health-kpi-grid health-kpi-grid--six">
      <article v-for="i in 6" :key="i" class="health-kpi-card">Cargando...</article>
    </div>

    <div v-else class="health-kpi-grid health-kpi-grid--six">
      <article v-for="kpi in kpis" :key="kpi.key" class="health-kpi-card">
        <p class="health-kpi-label">{{ kpi.label }}</p>
        <p class="health-kpi-value" :class="{ gold: kpi.highlight === 'gold' }">{{ kpi.value }}</p>
        <span v-if="kpi.badge" class="health-kpi-badge">{{ kpi.badge }}</span>
        <p v-if="kpi.subtitle" class="health-kpi-subtitle">{{ kpi.subtitle }}</p>
      </article>
    </div>

    <div class="health-main-grid health-main-grid--single">
      <AdminRevenueTrendChart
        :title="chartTitle"
        :ranges="chartPeriods"
        :range="chartPeriod"
        :granularity="granularity"
        :orders="ordersByMetric"
        :from="rangeStart"
        :loading="pending"
        color="#D4AF37"
        :metric-options="metricOptions"
        :metric="chartMetric"
        empty-title="Sin ganancias en este periodo"
        empty-subtitle="Los pedidos al detal y mayorista aparecerán aquí"
        @update:range="chartPeriod = $event as ChartPeriod"
        @update:metric="chartMetric = $event as ProfitMetric"
        @retry="refresh()"
      />
    </div>

    <section class="health-table-card">
      <div class="health-table-header">
        <h3>Ventas con desglose financiero</h3>
      </div>

      <table class="health-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Reloj</th>
            <th>Estado</th>
            <th>Costo</th>
            <th>Ganancia</th>
            <th>Comisión (%)</th>
            <th>Comisión</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!activityRows.length">
            <td colspan="9">Sin ventas en el periodo seleccionado.</td>
          </tr>
          <tr v-for="row in activityRows" :key="row.id">
            <td>{{ row.orderId }}</td>
            <td>{{ row.date }}</td>
            <td>{{ row.type }}</td>
            <td>{{ row.watch }}</td>
            <td>{{ row.status }}</td>
            <td>{{ row.cost }}</td>
            <td class="profit-cell">{{ row.profit }}</td>
            <td>{{ row.commissionPercent }}</td>
            <td>{{ row.commission }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
