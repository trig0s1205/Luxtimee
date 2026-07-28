<script setup lang="ts">
const props = withDefaults(defineProps<{
  labels: string[];
  values: number[];
  strokeColor?: string;
  chartId?: string;
}>(), {
  strokeColor: '#c8a96e',
  chartId: 'admin-chart',
});

const W = 600;
const H = 200;
const padX = 20;
const padY = 20;

const gradientId = computed(() => `${props.chartId}-gradient`);
const glowId = computed(() => `${props.chartId}-glow`);

const chartPoints = computed(() => {
  const data = props.values;
  if (!data.length) return [];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const plotBottom = 170;

  return data.map((val, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * (W - padX * 2);
    const y = padY + (1 - (val - min) / range) * (plotBottom - padY);
    return { x, y };
  });
});

const chartPath = computed(() => {
  const pts = chartPoints.value;
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
});

const chartAreaPath = computed(() => {
  const pts = chartPoints.value;
  if (!pts.length) return '';
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last.x} 180 L ${first.x} 180 Z`;
});
</script>

<template>
  <svg class="health-chart-svg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.35" />
        <stop offset="100%" :stop-color="strokeColor" stop-opacity="0" />
      </linearGradient>
      <filter :id="glowId">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
      <line v-for="i in 5" :key="i" x1="20" :y1="i * 36" x2="580" :y2="i * 36" />
    </g>

    <path :d="chartAreaPath" :fill="`url(#${gradientId})`" />
    <path
      :d="chartPath"
      fill="none"
      :stroke="strokeColor"
      stroke-width="2.5"
      :filter="`url(#${glowId})`"
    />

    <g fill="rgba(184,176,160,0.5)" font-size="10" font-family="Montserrat, sans-serif">
      <text
        v-for="(label, i) in labels"
        :key="`${label}-${i}`"
        :x="chartPoints[i]?.x ?? 0"
        y="196"
        text-anchor="middle"
      >
        {{ label }}
      </text>
    </g>
  </svg>
</template>
