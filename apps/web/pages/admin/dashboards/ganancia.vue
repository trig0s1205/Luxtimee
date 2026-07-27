<script setup lang="ts">
import type { ProfitDashboardDto } from '@luxtime/shared';
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

const { data: dashboard, refresh, pending } = await useAsyncData(
  'profit-dashboard',
  () => api.get<ProfitDashboardDto>(`/dashboards/profit?period=${chartPeriod.value}`),
  { watch: [chartPeriod] },
);

const kpis = computed(() => {
  const data = dashboard.value;
  if (!data) return [];

  const avgMargin = data.items.length
    ? Math.round(data.items.reduce((sum, item) => sum + item.retailMarginPercentage, 0) / data.items.length)
    : 0;

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
      subtitle: `Costo total: ${formatCop(data.totalCost)}`,
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'commission',
      label: 'Comisión secretaría',
      value: formatCop(data.totalCommission),
      subtitle: 'Acumulado por relojes vendidos',
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'margin',
      label: 'Margen promedio',
      value: `${avgMargin}%`,
      subtitle: 'Margen bruto al detal',
      highlight: 'white' as const,
      badge: null,
    },
  ];
});

const activityRows = computed(() =>
  (dashboard.value?.items ?? []).map((item) => ({
    id: item.orderId,
    orderId: item.readableId,
    date: new Date(item.paidAt).toLocaleDateString('es-CO'),
    watch: item.productName,
    status: 'Completado',
    statusType: 'done' as const,
    cost: formatCop(item.cost),
    profit: formatCop(item.profit),
    commission: formatCop(item.commission),
    margin: `${item.retailMarginPercentage}%`,
    commissionPercent: `${item.commissionPercent}%`,
  })),
);

const chartData = computed(() => {
  const items = dashboard.value?.items ?? [];
  if (!items.length) {
    return { labels: ['Sin datos'], values: [0] };
  }

  const grouped = new Map<string, number>();
  for (const item of items) {
    const key = new Date(item.paidAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    grouped.set(key, (grouped.get(key) ?? 0) + item.profit);
  }

  return {
    labels: [...grouped.keys()],
    values: [...grouped.values()],
  };
});

async function exportReport(type: 'pdf' | 'excel') {
  const config = useRuntimeConfig();
  const endpoint = type === 'pdf' ? 'profit/export/pdf' : 'profit/export/excel';
  window.open(`${config.public.apiBaseUrl}/dashboards/${endpoint}?period=${chartPeriod.value}`, '_blank');
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
      <div class="health-header-actions">
        <button type="button" class="health-export-btn" @click="exportReport('pdf')">
          Exportar PDF
        </button>
        <button type="button" class="health-export-btn" @click="exportReport('excel')">
          Exportar Excel
        </button>
      </div>
    </header>

    <div v-if="pending" class="health-kpi-grid">
      <article v-for="i in 4" :key="i" class="health-kpi-card">Cargando...</article>
    </div>

    <div v-else class="health-kpi-grid">
      <article v-for="kpi in kpis" :key="kpi.key" class="health-kpi-card">
        <p class="health-kpi-label">{{ kpi.label }}</p>
        <p class="health-kpi-value" :class="{ gold: kpi.highlight === 'gold' }">{{ kpi.value }}</p>
        <span v-if="kpi.badge" class="health-kpi-badge">{{ kpi.badge }}</span>
        <p v-if="kpi.subtitle" class="health-kpi-subtitle">{{ kpi.subtitle }}</p>
      </article>
    </div>

    <div class="health-main-grid">
      <section class="health-chart-card">
        <div class="health-chart-header">
          <h2 class="health-chart-title">Evolución de Ganancias</h2>
          <div class="health-chart-toggle">
            <button
              v-for="period in chartPeriods"
              :key="period.key"
              type="button"
              :class="{ active: chartPeriod === period.key }"
              @click="chartPeriod = period.key"
            >
              {{ period.label }}
            </button>
          </div>
        </div>

        <AdminLineChart
          chart-id="profit-chart"
          stroke-color="#D4AF37"
          :labels="chartData.labels"
          :values="chartData.values"
        />
      </section>
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
            <th>Reloj</th>
            <th>Costo</th>
            <th>Ganancia</th>
            <th>Margen</th>
            <th>Comisión (%)</th>
            <th>Comisión</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!activityRows.length">
            <td colspan="8">Sin ventas en el periodo seleccionado.</td>
          </tr>
          <tr v-for="row in activityRows" :key="row.id">
            <td>{{ row.orderId }}</td>
            <td>{{ row.date }}</td>
            <td>{{ row.watch }}</td>
            <td>{{ row.cost }}</td>
            <td class="profit-cell">{{ row.profit }}</td>
            <td>{{ row.margin }}</td>
            <td>{{ row.commissionPercent }}</td>
            <td>{{ row.commission }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
