<script setup lang="ts">
import type { RevenueDashboardDto } from '@luxtime/shared';
import type { ChartGranularity, ChartOrderInput } from '~/utils/chart-series';

export type ChartRange = 'today' | '1_week' | '1_month' | 'historical';

const api = useApi();
const range = ref<ChartRange>('1_month');

const ranges: { key: ChartRange; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '1_week', label: '1 semana' },
  { key: '1_month', label: '1 mes' },
  { key: 'historical', label: 'Histórico' },
];

const granularity = computed<ChartGranularity>(() => {
  if (range.value === 'today') return 'hour';
  if (range.value === 'historical') return 'month';
  return 'day';
});

const { data: revenue, pending, error, refresh } = await useAsyncData(
  'admin-revenue-chart',
  () => api.get<RevenueDashboardDto>('/dashboards/revenue', { range: range.value }),
  { watch: [range], default: () => ({ range: '1_month' as ChartRange, orders: [], total: 0 }) },
);

const orders = computed<ChartOrderInput[]>(() =>
  (revenue.value?.orders ?? []).map((order) => ({
    id: order.id,
    at: order.paidAt,
    amount: order.total,
    sku: order.readableId,
  })),
);

// Debe coincidir con revenueRangeStart() del backend para que el eje X no se corte.
const rangeStart = computed<number | null>(() => {
  const now = new Date();
  if (range.value === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (range.value === '1_week') return now.getTime() - 7 * 86400000;
  if (range.value === '1_month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return null;
});
</script>

<template>
  <AdminRevenueTrendChart
    title="INGRESOS"
    :ranges="ranges"
    :range="range"
    :granularity="granularity"
    :orders="orders"
    :from="rangeStart"
    :loading="pending"
    :error="!!error"
    color="#D4AF37"
    empty-title="Sin ventas en este periodo"
    empty-subtitle="Los pedidos confirmados aparecerán aquí"
    @update:range="range = $event as ChartRange"
    @retry="refresh()"
  />
</template>
