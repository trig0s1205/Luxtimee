<script setup lang="ts">
import type { ApexOptions } from 'apexcharts';
import {
  buildChartSeries,
  formatAxisCurrency,
  type ChartGranularity,
  type ChartMarkerPoint,
  type ChartOrderInput,
} from '~/utils/chart-series';
import { formatCop } from '~/utils/format';

export type ChartOption = {
  key: string;
  label: string;
};

export type { ChartGranularity, ChartOrderInput };

const props = withDefaults(defineProps<{
  title: string;
  ranges: ChartOption[];
  range: string;
  orders: ChartOrderInput[];
  granularity?: ChartGranularity;
  from?: number | null;
  to?: number | null;
  loading?: boolean;
  error?: boolean;
  color?: string;
  valueFormatter?: (value: number) => string;
  emptyTitle?: string;
  emptySubtitle?: string;
  metricOptions?: ChartOption[];
  metric?: string;
}>(), {
  granularity: 'day',
  from: null,
  to: null,
  loading: false,
  error: false,
  color: '#D4AF37',
  valueFormatter: undefined,
  emptyTitle: 'Sin datos en este periodo',
  emptySubtitle: 'La información aparecerá aquí una vez haya registros',
  metricOptions: undefined,
  metric: undefined,
});

const emit = defineEmits<{
  'update:range': [string];
  'update:metric': [string];
  retry: [];
}>();

const activeSubtitle = computed(
  () => props.ranges.find((item) => item.key === props.range)?.label ?? '',
);

const chartSeries = computed(() =>
  buildChartSeries({
    orders: props.orders,
    granularity: props.granularity,
    from: props.from,
    to: props.to,
  }),
);

const hasData = computed(() => chartSeries.value.points.length > 0);

function formatExactDateTime(timestamp: number) {
  return new Date(timestamp)
    .toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/\./g, '');
}

function renderOrderTooltip(marker: ChartMarkerPoint) {
  return `
    <div class="trend-chart-apex-tooltip">
      <strong class="trend-chart-apex-tooltip-value">${formatCop(marker.amount)}</strong>
      <span class="trend-chart-apex-tooltip-date">${formatExactDateTime(marker.x)}</span>
      <p class="trend-chart-apex-tooltip-sku">SKU: ${marker.sku}</p>
    </div>
  `;
}

const series = computed(() => [
  {
    name: props.title,
    type: 'area',
    data: chartSeries.value.points.map((point) => [point.x, point.y]),
  },
  {
    name: 'Pedidos',
    type: 'scatter',
    data: chartSeries.value.markers.map((marker) => [marker.x, marker.y]),
  },
]);

function formatBucketDate(timestamp: number) {
  const options: Intl.DateTimeFormatOptions = props.granularity === 'hour'
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : props.granularity === 'month'
      ? { month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' };

  return new Date(timestamp)
    .toLocaleString('es-CO', options)
    .replace(/\./g, '')
    .toUpperCase();
}

const xAxisFormat = computed(() => {
  if (props.granularity === 'hour') return 'HH:mm';
  if (props.granularity === 'month') return 'MMM yy';
  return 'd MMM';
});

const xTickAmount = computed(() => {
  const buckets = chartSeries.value.bucketCount;
  if (buckets <= 2) return Math.max(buckets, 1);
  return Math.min(buckets - 1, props.granularity === 'day' ? 7 : 6);
});

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'line',
    height: 320,
    background: 'transparent',
    fontFamily: 'Montserrat, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 700,
      animateGradually: { enabled: true, delay: 60 },
      dynamicAnimation: { enabled: true, speed: 350 },
    },
  },
  colors: [props.color, props.color],
  stroke: {
    curve: 'smooth',
    width: [3, 0],
    lineCap: 'round',
  },
  fill: {
    type: ['gradient', 'solid'],
    gradient: {
      shade: 'dark',
      type: 'vertical',
      shadeIntensity: 0.35,
      opacityFrom: 0.42,
      opacityTo: 0,
      stops: [0, 80, 100],
      colorStops: [
        { offset: 0, color: props.color, opacity: 0.38 },
        { offset: 70, color: props.color, opacity: 0.08 },
        { offset: 100, color: props.color, opacity: 0 },
      ],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(212, 175, 55, 0.06)',
    strokeDashArray: 0,
    padding: { left: 12, right: 20, top: 4, bottom: 0 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  },
  markers: {
    size: [0, 4],
    strokeWidth: [0, 2],
    colors: [props.color, '#f5f0e6'],
    strokeColors: ['#f5f0e6', props.color],
    hover: { size: 7 },
  },
  xaxis: {
    type: 'datetime',
    min: chartSeries.value.from || undefined,
    max: chartSeries.value.to || undefined,
    tickAmount: xTickAmount.value || undefined,
    labels: {
      datetimeUTC: false,
      format: xAxisFormat.value,
      hideOverlappingLabels: true,
      rotate: 0,
      style: {
        colors: 'rgba(184,176,160,0.55)',
        fontSize: '11px',
        fontFamily: 'Montserrat, sans-serif',
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    crosshairs: {
      show: true,
      stroke: { color: 'rgba(212, 175, 55, 0.2)', width: 1, dashArray: 4 },
    },
    tooltip: { enabled: false },
  },
  yaxis: {
    min: 0,
    // El tope del eje es el pedido más alto del rango filtrado, así que la
    // escala (y la posición de cada punto) se recalcula sola al cambiar filtro.
    max: chartSeries.value.maxValue > 0 ? chartSeries.value.maxValue : undefined,
    tickAmount: 4,
    forceNiceScale: false,
    labels: {
      style: {
        colors: 'rgba(184,176,160,0.45)',
        fontSize: '10px',
        fontFamily: 'Montserrat, sans-serif',
      },
      formatter: (value: number) => formatAxisCurrency(value),
    },
  },
  tooltip: {
    enabled: true,
    shared: false,
    intersect: true,
    custom({ seriesIndex, dataPointIndex }) {
      if (seriesIndex === 1) {
        const marker = chartSeries.value.markers[dataPointIndex];
        return marker ? renderOrderTooltip(marker) : '';
      }

      const point = chartSeries.value.points[dataPointIndex];
      if (!point) return '';

      const ordersAtPoint = chartSeries.value.markers.filter((marker) => marker.x === point.x);
      if (ordersAtPoint.length === 1) {
        return renderOrderTooltip(ordersAtPoint[0]);
      }
      if (ordersAtPoint.length > 1) {
        return `<div class="trend-chart-apex-tooltip-group">${ordersAtPoint.map(renderOrderTooltip).join('')}</div>`;
      }

      return `
        <div class="trend-chart-apex-tooltip">
          <span class="trend-chart-apex-tooltip-date">${formatBucketDate(point.x)}</span>
          <strong class="trend-chart-apex-tooltip-value">${formatCop(point.y)}</strong>
        </div>
      `;
    },
  },
  legend: { show: false },
  noData: {
    text: props.emptyTitle,
    align: 'center',
    verticalAlign: 'middle',
    style: {
      color: 'rgba(184,176,160,0.6)',
      fontSize: '13px',
      fontFamily: 'Montserrat, sans-serif',
    },
  },
}));
</script>

<template>
  <div class="trend-chart rounded-xl border border-black/5 p-5 md:p-6">
    <div class="trend-chart-header">
      <div>
        <h2 class="trend-chart-title">{{ title }}</h2>
        <p class="trend-chart-subtitle">{{ activeSubtitle }}</p>
      </div>

      <div class="trend-chart-filters">
        <div v-if="metricOptions?.length" class="trend-chart-pills" role="tablist" aria-label="Métrica">
          <button
            v-for="item in metricOptions"
            :key="item.key"
            type="button"
            role="tab"
            class="trend-chart-pill"
            :class="{ 'is-active': metric === item.key }"
            :aria-selected="metric === item.key"
            :disabled="loading"
            @click="emit('update:metric', item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="trend-chart-pills" role="tablist" aria-label="Rango de fechas">
          <button
            v-for="item in ranges"
            :key="item.key"
            type="button"
            role="tab"
            class="trend-chart-pill"
            :class="{ 'is-active': range === item.key }"
            :aria-selected="range === item.key"
            :disabled="loading"
            @click="emit('update:range', item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="trend-chart-error">
      <p>No se pudieron cargar los datos.</p>
      <button type="button" @click="emit('retry')">Reintentar</button>
    </div>

    <div v-else class="trend-chart-body" :class="{ 'is-loading': loading }">
      <ClientOnly>
        <ApexChart
          v-if="hasData"
          :key="granularity"
          type="line"
          height="320"
          :options="chartOptions"
          :series="series"
        />
      </ClientOnly>

      <div v-if="!loading && !hasData" class="trend-chart-empty">
        <p>{{ emptyTitle }}</p>
        <span>{{ emptySubtitle }}</span>
      </div>

      <div v-if="loading" class="trend-chart-shimmer" aria-hidden="true" />
    </div>
  </div>
</template>

<style>
.trend-chart-apex-tooltip {
  padding: 10px 14px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 12px 32px rgba(20, 20, 20, 0.12);
  text-align: left;
  max-width: 260px;
}

.trend-chart-apex-tooltip-date {
  display: block;
  margin-bottom: 4px;
  font-family: Montserrat, sans-serif;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgba(90, 90, 90, 0.85);
}

.trend-chart-apex-tooltip-value {
  display: block;
  margin-bottom: 6px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 500;
  color: #9a7a45;
}

.trend-chart-apex-tooltip-sku {
  margin: 0;
  font-family: Montserrat, sans-serif;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(90, 90, 90, 0.9);
}

.trend-chart-apex-tooltip-group .trend-chart-apex-tooltip + .trend-chart-apex-tooltip {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}
</style>

<style scoped>
.trend-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.trend-chart-title {
  margin: 0;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--white-dim);
}

.trend-chart-subtitle {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--white);
}

.trend-chart-filters {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.trend-chart-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(200, 169, 110, 0.1);
}

.trend-chart-pill {
  padding: 7px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: rgba(184, 176, 160, 0.75);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  white-space: nowrap;
}

.trend-chart-pill:disabled {
  opacity: 0.6;
  cursor: wait;
}

.trend-chart-pill.is-active {
  background: #f5f0e6;
  color: #111111;
  font-weight: 600;
}

.trend-chart-body {
  position: relative;
  min-height: 320px;
}

.trend-chart-body.is-loading :deep(.apexcharts-canvas) {
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.trend-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  border: 1px dashed rgba(212, 175, 55, 0.14);
  background: rgba(212, 175, 55, 0.02);
  text-align: center;
}

.trend-chart-empty p {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--white);
}

.trend-chart-empty span {
  font-size: 12px;
  color: var(--white-dim);
}

.trend-chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 200px;
  justify-content: center;
  color: var(--white-dim);
  font-size: 13px;
}

.trend-chart-error button {
  padding: 8px 16px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--gold);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.trend-chart-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(212, 175, 55, 0.06) 50%,
    transparent 70%
  );
  background-size: 200% 100%;
  animation: trend-chart-shimmer 1.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes trend-chart-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
