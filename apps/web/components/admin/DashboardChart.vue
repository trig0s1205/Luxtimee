<script setup lang="ts">
import type { RevenueDashboardDto } from '@luxtime/shared';
import type { ChartGranularity, ChartOrderInput } from '~/utils/chart-series';
import { ADMIN_CACHE_MS } from '~/utils/admin-cache';

export type ChartRange = 'today' | '1_week' | '1_month' | 'historical';

const emptyRevenue = (range: ChartRange): RevenueDashboardDto => ({
  range,
  orders: [],
  total: 0,
});

const api = useApi();
const range = ref<ChartRange>('1_month');
const loadFailed = ref(false);

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

const cacheKey = computed(() => `admin-revenue-chart-${range.value}`);

const { data: revenue, pending, error, refresh } = useAdminCachedData(
  cacheKey,
  async () => {
    try {
      const data = await api.get<RevenueDashboardDto>('/dashboards/revenue', { range: range.value });
      loadFailed.value = false;
      return data;
    } catch {
      loadFailed.value = true;
      return emptyRevenue(range.value);
    }
  },
  {
    staleTime: ADMIN_CACHE_MS.dashboards,
    watch: [cacheKey],
    default: () => emptyRevenue(range.value),
  },
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

const chartError = computed(() => loadFailed.value || !!error.value);

async function retry() {
  loadFailed.value = false;
  await refresh();
}
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
    :error="chartError"
    color="#D4AF37"
    empty-title="Sin ventas en este periodo"
    empty-subtitle="Los pedidos confirmados aparecerán aquí"
    @update:range="range = $event as ChartRange"
    @retry="retry"
  />
</template>
