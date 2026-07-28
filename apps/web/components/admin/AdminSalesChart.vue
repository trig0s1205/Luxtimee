<script setup lang="ts">
export type ChartOrderPoint = {
  id: string;
  at: string;
  value: number;
  title: string;
  lines: string[];
};

type ChartPeriod = 'day' | 'week' | 'month' | 'all';

const props = withDefaults(defineProps<{
  orders: ChartOrderPoint[];
  boundsFrom?: string;
  boundsTo?: string;
  period?: ChartPeriod;
  loading?: boolean;
}>(), {
  period: 'day',
  loading: false,
});

const W = 800;
const H = 280;
const padL = 58;
const padR = 28;
const padT = 28;
const padB = 48;
const plotW = W - padL - padR;
const plotH = H - padT - padB;

const { $gsap } = useNuxtApp();
const chartRef = ref<HTMLElement | null>(null);
const lineRef = ref<SVGPathElement | null>(null);
const areaRef = ref<SVGPathElement | null>(null);
const hoveredId = ref<string | null>(null);

const sortedOrders = computed(() =>
  [...props.orders].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
);

const timeRange = computed(() => {
  const min = new Date(props.boundsFrom ?? props.orders[0]?.at ?? Date.now()).getTime();
  const max = new Date(props.boundsTo ?? Date.now()).getTime();
  return { min, max: Math.max(max, min + 60_000) };
});

const seriesPoints = computed(() => {
  const { min, max } = timeRange.value;
  let running = 0;
  const points: { t: number; v: number; orderId?: string }[] = [{ t: min, v: 0 }];

  for (const order of sortedOrders.value) {
    running += order.value;
    points.push({ t: new Date(order.at).getTime(), v: running, orderId: order.id });
  }

  if (sortedOrders.value.length) {
    points.push({ t: max, v: running });
  }

  return points;
});

const valueMax = computed(() => {
  const peak = Math.max(...seriesPoints.value.map((p) => p.v), 0);
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude) * magnitude;
});

function toX(timestamp: number) {
  const { min, max } = timeRange.value;
  const ratio = (timestamp - min) / (max - min);
  return padL + ratio * plotW;
}

function toY(value: number) {
  const ratio = value / valueMax.value;
  return padT + (1 - ratio) * plotH;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

const plotCoords = computed(() =>
  seriesPoints.value.map((point) => ({
    x: toX(point.t),
    y: toY(point.v),
    orderId: point.orderId,
  })),
);

const linePath = computed(() => smoothPath(plotCoords.value));

const areaPath = computed(() => {
  if (!linePath.value) return '';
  const base = padT + plotH;
  const last = plotCoords.value[plotCoords.value.length - 1];
  const first = plotCoords.value[0];
  if (!last || !first) return '';
  return `${linePath.value} L ${last.x} ${base} L ${first.x} ${base} Z`;
});

const orderDots = computed(() => {
  const seen = new Map<string, number>();
  return sortedOrders.value.map((order) => {
    const t = new Date(order.at).getTime();
    const key = String(t);
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    const totalAtKey = sortedOrders.value.filter((item) => new Date(item.at).getTime() === t).length;
    const jitter = totalAtKey > 1 ? (index - (totalAtKey - 1) / 2) * 12 : 0;

    let running = 0;
    for (const item of sortedOrders.value) {
      running += item.value;
      if (item.id === order.id) break;
    }

    return {
      id: order.id,
      x: toX(t) + jitter,
      y: toY(running),
      order,
    };
  });
});

const yTicks = computed(() =>
  Array.from({ length: 5 }, (_, index) => {
    const value = (valueMax.value / 4) * (4 - index);
    return {
      value,
      label: formatAxis(value),
      y: toY(value),
    };
  }),
);

const xTicks = computed(() => {
  const { min, max } = timeRange.value;
  const count = props.period === 'day' ? 5 : props.period === 'week' ? 7 : 6;
  const formatter = new Intl.DateTimeFormat('es-CO', getDateFormatOptions());

  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const at = min + (max - min) * ratio;
    return {
      at,
      label: formatter.format(new Date(at)),
      x: toX(at),
    };
  });
});

function getDateFormatOptions(): Intl.DateTimeFormatOptions {
  if (props.period === 'day') return { hour: '2-digit', minute: '2-digit' };
  if (props.period === 'month' || props.period === 'all') return { day: 'numeric', month: 'short' };
  return { weekday: 'short', day: 'numeric' };
}

function formatAxis(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

const activeDot = computed(() => orderDots.value.find((dot) => dot.id === hoveredId.value) ?? null);

const tooltipStyle = computed(() => {
  if (!activeDot.value) return {};
  const xPct = (activeDot.value.x / W) * 100;
  const yPct = (activeDot.value.y / H) * 100;
  const flipX = activeDot.value.x > W * 0.72;
  const flipY = activeDot.value.y < H * 0.28;
  return {
    left: `${xPct}%`,
    top: `${yPct}%`,
    transform: `translate(${flipX ? '-100%' : '-50%'}, ${flipY ? '12px' : 'calc(-100% - 14px)'})`,
    marginLeft: flipX ? '-10px' : '0',
  };
});

let animCtx: ReturnType<typeof $gsap.context> | null = null;

function runAnimation() {
  if (!import.meta.client) return;
  animCtx?.revert();
  animCtx = $gsap.context(() => {
    const line = lineRef.value;
    const area = areaRef.value;
    const dots = chartRef.value?.querySelectorAll('.sales-chart-dot');
    const labels = chartRef.value?.querySelectorAll('.sales-chart-axis-label');

    if (line) {
      const length = line.getTotalLength();
      $gsap.set(line, { strokeDasharray: length, strokeDashoffset: length, opacity: 1 });
      $gsap.to(line, { strokeDashoffset: 0, duration: 1.15, ease: 'power3.out' });
    }

    if (area) {
      $gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.85, delay: 0.15, ease: 'power2.out' });
    }

    if (dots?.length) {
      $gsap.fromTo(
        dots,
        { opacity: 0, attr: { r: 0 } },
        { opacity: 1, attr: { r: 4.5 }, duration: 0.45, stagger: 0.07, delay: 0.35, ease: 'back.out(2.2)' },
      );
    }

    if (labels?.length) {
      $gsap.fromTo(labels, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, delay: 0.1 });
    }
  }, chartRef);
}

watch(
  () => [props.orders, props.period, props.boundsFrom, props.boundsTo, props.loading] as const,
  async (_value, _old, onCleanup) => {
    if (!chartRef.value || props.loading) return;
    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    await $gsap.to(chartRef.value, { opacity: 0.35, duration: 0.18, ease: 'power1.in' });
    if (cancelled || !chartRef.value) return;
    await nextTick();
    runAnimation();
    if (!cancelled && chartRef.value) {
      await $gsap.to(chartRef.value, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    }
  },
  { deep: true, flush: 'post', immediate: true },
);

onBeforeUnmount(() => {
  animCtx?.revert();
});
</script>

<template>
  <div
    ref="chartRef"
    class="sales-chart"
    :class="{ 'is-loading': loading }"
    @mouseleave="hoveredId = null"
  >
    <div v-if="!orders.length && !loading" class="sales-chart-empty">
      <p>Sin ventas en este periodo</p>
      <span>Los pedidos confirmados aparecerán aquí</span>
    </div>

    <svg
      v-else
      class="sales-chart-svg"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sales-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c8a96e" stop-opacity="0.28" />
          <stop offset="85%" stop-color="#c8a96e" stop-opacity="0.02" />
          <stop offset="100%" stop-color="#c8a96e" stop-opacity="0" />
        </linearGradient>
        <filter id="sales-chart-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g class="sales-chart-grid">
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick.value}`"
          :x1="padL"
          :y1="tick.y"
          :x2="W - padR"
          :y2="tick.y"
        />
      </g>

      <g class="sales-chart-y-labels">
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          class="sales-chart-axis-label"
          x="0"
          :y="tick.y + 4"
        >
          {{ tick.label }}
        </text>
      </g>

      <path v-if="areaPath" ref="areaRef" class="sales-chart-area" :d="areaPath" />
      <path
        v-if="linePath"
        ref="lineRef"
        class="sales-chart-line"
        :d="linePath"
        filter="url(#sales-chart-glow)"
      />

      <g v-if="orderDots.length">
        <circle
          v-for="dot in orderDots"
          :key="dot.id"
          class="sales-chart-dot"
          :class="{ active: hoveredId === dot.id }"
          :cx="dot.x"
          :cy="dot.y"
          :r="hoveredId === dot.id ? 6.5 : 4.5"
          @mouseenter="hoveredId = dot.id"
        />
        <circle
          v-for="dot in orderDots"
          :key="`${dot.id}-hit`"
          class="sales-chart-dot-hit"
          :cx="dot.x"
          :cy="dot.y"
          r="14"
          @mouseenter="hoveredId = dot.id"
        />
      </g>

      <g class="sales-chart-x-labels">
        <text
          v-for="(tick, index) in xTicks"
          :key="`x-${index}`"
          class="sales-chart-axis-label"
          :x="tick.x"
          :y="H - 14"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>
    </svg>

    <Transition name="sales-tooltip">
      <div v-if="activeDot" class="sales-chart-tooltip" :style="tooltipStyle">
        <p class="sales-chart-tooltip-amount">{{ activeDot.order.title }}</p>
        <div class="sales-chart-tooltip-divider" />
        <p v-for="(line, index) in activeDot.order.lines" :key="index">{{ line }}</p>
      </div>
    </Transition>

    <div v-if="loading" class="sales-chart-shimmer" aria-hidden="true" />
  </div>
</template>

<style scoped>
.sales-chart {
  position: relative;
  min-height: 280px;
  transition: opacity 0.25s ease;
}

.sales-chart.is-loading {
  pointer-events: none;
}

.sales-chart-svg {
  display: block;
  width: 100%;
  height: 280px;
}

.sales-chart-grid line {
  stroke: rgba(255, 255, 255, 0.045);
  stroke-width: 1;
}

.sales-chart-axis-label {
  font-family: var(--font-body);
  font-size: 10px;
  fill: rgba(184, 176, 160, 0.55);
  letter-spacing: 0.04em;
}

.sales-chart-area {
  opacity: 0;
}

.sales-chart-line {
  fill: none;
  stroke: #c8a96e;
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sales-chart-dot {
  fill: #f5f0e6;
  stroke: #c8a96e;
  stroke-width: 2;
  transition: r 0.2s ease, fill 0.2s ease;
  pointer-events: none;
}

.sales-chart-dot.active {
  fill: #c8a96e;
  stroke: #f5f0e6;
}

.sales-chart-dot-hit {
  fill: transparent;
  cursor: pointer;
}

.sales-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  border: 1px dashed rgba(200, 169, 110, 0.14);
  background: rgba(255, 255, 255, 0.015);
  text-align: center;
}

.sales-chart-empty p {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--white);
}

.sales-chart-empty span {
  font-size: 12px;
  color: var(--white-dim);
}

.sales-chart-tooltip {
  position: absolute;
  z-index: 5;
  min-width: 200px;
  max-width: 260px;
  padding: 12px 14px;
  border: 1px solid rgba(200, 169, 110, 0.22);
  background: rgba(8, 8, 8, 0.97);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.sales-chart-tooltip-amount {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
}

.sales-chart-tooltip-divider {
  height: 1px;
  margin-bottom: 8px;
  background: rgba(200, 169, 110, 0.15);
}

.sales-chart-tooltip p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(184, 176, 160, 0.9);
}

.sales-chart-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(200, 169, 110, 0.06) 50%,
    transparent 70%
  );
  background-size: 200% 100%;
  animation: sales-chart-shimmer 1.2s ease-in-out infinite;
}

.sales-tooltip-enter-active,
.sales-tooltip-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sales-tooltip-enter-from,
.sales-tooltip-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-100% - 6px)) scale(0.96);
}

@keyframes sales-chart-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
