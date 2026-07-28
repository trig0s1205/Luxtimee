export type ChartGranularity = 'hour' | 'day' | 'month';

export type ChartOrderInput = {
  id: string;
  at: string | number | Date;
  amount: number | string;
  sku: string;
};

export type ChartSeriesPoint = { x: number; y: number };

export type ChartMarkerPoint = {
  x: number;
  y: number;
  id: string;
  amount: number;
  sku: string;
};

export type ChartSeries = {
  points: ChartSeriesPoint[];
  markers: ChartMarkerPoint[];
  total: number;
  maxValue: number;
  from: number;
  to: number;
  bucketCount: number;
};

const MAX_BUCKETS = 400;

export function toTimestamp(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function bucketStart(timestamp: number, granularity: ChartGranularity): number {
  const date = new Date(timestamp);
  if (granularity === 'hour') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
  }
  if (granularity === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function nextBucketStart(timestamp: number, granularity: ChartGranularity): number {
  const date = new Date(timestamp);
  if (granularity === 'hour') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
  }
  if (granularity === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/**
 * Construye la serie temporal de la gráfica:
 * cada pedido es un vértice real de la línea (por eso los marcadores nunca
 * quedan flotando fuera de ella), los intervalos sin ventas se rellenan con 0
 * según la granularidad y todo queda ordenado cronológicamente.
 */
export function buildChartSeries(options: {
  orders: ChartOrderInput[];
  granularity: ChartGranularity;
  from?: number | null;
  to?: number | null;
}): ChartSeries {
  const { granularity } = options;

  const sanitized = options.orders
    .map((order) => {
      const timestamp = toTimestamp(order.at);
      const amount = Number(order.amount);
      if (timestamp === null || !Number.isFinite(amount)) return null;
      return { id: order.id, x: timestamp, amount, sku: order.sku };
    })
    .filter((order): order is { id: string; x: number; amount: number; sku: string } => order !== null)
    .sort((a, b) => a.x - b.x);

  if (!sanitized.length) {
    return { points: [], markers: [], total: 0, maxValue: 0, from: 0, to: 0, bucketCount: 0 };
  }

  const fromTimestamp = toTimestamp(options.from) ?? sanitized[0].x;
  const toTimestampValue = Math.max(
    toTimestamp(options.to) ?? Date.now(),
    sanitized[sanitized.length - 1].x,
  );

  // Vértices de pedidos: si dos caen en el mismo instante se suman para no
  // generar dos puntos en la misma coordenada X.
  const orderVertices = new Map<number, number>();
  const bucketsWithSales = new Set<number>();
  for (const order of sanitized) {
    orderVertices.set(order.x, (orderVertices.get(order.x) ?? 0) + order.amount);
    bucketsWithSales.add(bucketStart(order.x, granularity));
  }

  const firstBucket = Math.min(
    bucketStart(fromTimestamp, granularity),
    bucketStart(sanitized[0].x, granularity),
  );
  const lastBucket = bucketStart(toTimestampValue, granularity);

  const vertices = new Map(orderVertices);
  let cursor = firstBucket;
  let guard = 0;
  while (cursor <= lastBucket && guard < MAX_BUCKETS) {
    if (!bucketsWithSales.has(cursor) && !vertices.has(cursor)) {
      vertices.set(cursor, 0);
    }
    cursor = nextBucketStart(cursor, granularity);
    guard += 1;
  }

  const points: ChartSeriesPoint[] = [...vertices.entries()]
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => a.x - b.x);

  const markers: ChartMarkerPoint[] = sanitized.map((order) => ({
    x: order.x,
    y: orderVertices.get(order.x) ?? order.amount,
    id: order.id,
    amount: order.amount,
    sku: order.sku,
  }));

  return {
    points,
    markers,
    total: sanitized.reduce((sum, order) => sum + order.amount, 0),
    maxValue: points.reduce((max, point) => Math.max(max, point.y), 0),
    from: points[0]?.x ?? fromTimestamp,
    to: Math.max(points[points.length - 1]?.x ?? toTimestampValue, toTimestampValue),
    bucketCount: Math.max(guard, bucketsWithSales.size),
  };
}

export function formatAxisCurrency(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0';

  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);

  if (absolute >= 1_000_000) {
    return `${sign}$${Math.round(absolute / 1_000_000)}M`;
  }
  if (absolute >= 1_000) {
    return `${sign}$${Math.round(absolute / 1_000)}K`;
  }
  return `${sign}$${Math.round(absolute)}`;
}

export function formatCurrencyCompact(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0';

  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);

  if (absolute >= 1_000_000) {
    const millions = absolute / 1_000_000;
    return `${sign}$${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace('.0', '')}M`;
  }
  if (absolute >= 1_000) {
    const thousands = absolute / 1_000;
    return `${sign}$${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace('.0', '')}K`;
  }
  return `${sign}$${Math.round(absolute)}`;
}
