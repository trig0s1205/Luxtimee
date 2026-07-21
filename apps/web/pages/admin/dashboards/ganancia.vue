<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
if (!auth.loaded) {
  await auth.fetchMe();
}
if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

type ChartPeriod = 'week' | 'month' | 'quarter' | 'all';
const chartPeriod = ref<ChartPeriod>('month');

const chartPeriods: { key: ChartPeriod; label: string }[] = [
  { key: 'week', label: '1 semana' },
  { key: 'month', label: '1 mes' },
  { key: 'quarter', label: '3 meses' },
  { key: 'all', label: 'Histórico' },
];

const mockData = {
  kpis: [
    {
      key: 'today',
      label: 'Ganancia Hoy',
      value: '$1.2M COP',
      subtitle: 'Pedidos pagados hoy',
      highlight: 'gold' as const,
      badge: null,
    },
    {
      key: 'month',
      label: 'Ganancia del Mes',
      value: '$12.5M COP',
      subtitle: 'Desde el 1° del mes',
      highlight: 'white' as const,
      badge: null,
    },
    {
      key: 'commission',
      label: 'Comisión Secretaria',
      value: '$1.3M COP',
      subtitle: null,
      highlight: 'white' as const,
      badge: '+5%',
    },
    {
      key: 'margin',
      label: 'Margen Promedio',
      value: '35%',
      subtitle: 'Margen bruto actual',
      highlight: 'white' as const,
      badge: null,
    },
  ],
  chart: {
    week: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      values: [180000, 320000, 410000, 520000, 680000, 890000, 1200000],
    },
    month: {
      labels: ['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29'],
      values: [2100000, 3800000, 5200000, 8900000, 12500000],
    },
    quarter: {
      labels: ['Ago', 'Sep', 'Oct'],
      values: [8200000, 11400000, 12500000],
    },
    all: {
      labels: ['2023', '2024', '2025', '2026'],
      values: [28000000, 42000000, 58000000, 12500000],
    },
  },
  stockAlerts: [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=80&h=80&fit=crop',
      model: 'Rolex Submariner',
      sku: 'SKU: ROL-126610LN',
      left: 2,
      level: 'critical' as const,
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=80&h=80&fit=crop',
      model: 'Patek Philippe Nautilus',
      sku: 'SKU: PPK-5711/1A',
      left: 3,
      level: 'low' as const,
    },
    {
      id: '3',
      image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=80&h=80&fit=crop',
      model: 'Omega Speedmaster',
      sku: 'SKU: OMG-310.30.42',
      left: 1,
      level: 'critical' as const,
    },
    {
      id: '4',
      image: 'https://images.unsplash.com/photo-1547996160-81dfaaffebfe?w=80&h=80&fit=crop',
      model: 'Audemars Piguet Royal Oak',
      sku: 'SKU: AP-15500ST',
      left: 0,
      level: 'out' as const,
    },
  ],
  activity: [
    {
      id: '1',
      orderId: '0000300301',
      date: 'Oct 24, 2023',
      watch: 'Rolex Submariner',
      image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=80&h=80&fit=crop',
      status: 'Completado',
      statusType: 'done' as const,
      cost: '$4,500,000',
      profit: '$1,800,000',
      commission: '$90,000',
    },
    {
      id: '2',
      orderId: '0000300302',
      date: 'Oct 23, 2023',
      watch: 'Omega Speedmaster',
      image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=80&h=80&fit=crop',
      status: 'Pendiente',
      statusType: 'pending' as const,
      cost: '$2,800,000',
      profit: '$1,200,000',
      commission: '$60,000',
    },
    {
      id: '3',
      orderId: '0000300303',
      date: 'Oct 22, 2023',
      watch: 'Patek Philippe Nautilus',
      image: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=80&h=80&fit=crop',
      status: 'Completado',
      statusType: 'done' as const,
      cost: '$12,000,000',
      profit: '$4,500,000',
      commission: '$225,000',
    },
    {
      id: '4',
      orderId: '0000300304',
      date: 'Oct 21, 2023',
      watch: 'Audemars Piguet Royal Oak',
      image: 'https://images.unsplash.com/photo-1547996160-81dfaaffebfe?w=80&h=80&fit=crop',
      status: 'Completado',
      statusType: 'done' as const,
      cost: '$8,500,000',
      profit: '$3,200,000',
      commission: '$160,000',
    },
  ],
};

const activeChart = computed(() => mockData.chart[chartPeriod.value]);

function exportMock(type: 'pdf' | 'excel') {
  // Mock: conectará a API en fase posterior
  console.info(`Export ${type} — pendiente de API`);
}

useSeoMeta({ title: 'Dashboard de Ganancia — Luxtime Admin' });
</script>

<template>
  <div class="health-dashboard">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Dashboard de Ganancia (Super Admin)</h1>
        <p class="health-dashboard-subtitle">Detailed financial breakdown and commission reports</p>
      </div>
      <div class="health-header-actions">
        <button type="button" class="health-export-btn" @click="exportMock('pdf')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          Exportar PDF
        </button>
        <button type="button" class="health-export-btn" @click="exportMock('excel')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h2M8 17h2M12 13h4M12 17h4" />
          </svg>
          Exportar Excel
        </button>
      </div>
    </header>

    <div class="health-kpi-grid">
      <article v-for="kpi in mockData.kpis" :key="kpi.key" class="health-kpi-card">
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
          :labels="activeChart.labels"
          :values="activeChart.values"
        />
      </section>

      <aside class="health-alerts-card">
        <h3 class="health-alerts-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          Alerta de Stock
        </h3>

        <div class="profit-stock-list">
          <article v-for="item in mockData.stockAlerts" :key="item.id" class="profit-stock-item">
            <img :src="item.image" :alt="item.model" loading="lazy">
            <div class="profit-stock-info">
              <strong>{{ item.model }}</strong>
              <span>{{ item.sku }}</span>
              <p :class="item.level">
                <template v-if="item.level === 'out'">Sin stock</template>
                <template v-else>Quedan {{ item.left }} unidades</template>
              </p>
            </div>
          </article>
        </div>

        <NuxtLink to="/admin/inventario" class="health-table-link profit-inventory-link">
          Gestionar inventario →
        </NuxtLink>
      </aside>
    </div>

    <section class="health-table-card">
      <div class="health-table-header">
        <h3>Recent Activity</h3>
        <NuxtLink to="/admin/pedidos" class="health-table-link">Ver todos →</NuxtLink>
      </div>

      <table class="health-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Fecha</th>
            <th>Reloj</th>
            <th>Estado</th>
            <th>Costo</th>
            <th>Ganancia</th>
            <th>Comisión</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mockData.activity" :key="row.id">
            <td>{{ row.orderId }}</td>
            <td>{{ row.date }}</td>
            <td>
              <div class="health-table-watch">
                <img :src="row.image" :alt="row.watch" loading="lazy">
                <span>{{ row.watch }}</span>
              </div>
            </td>
            <td>
              <span class="order-status" :class="row.statusType">
                <span class="order-status-dot" />
                {{ row.status }}
              </span>
            </td>
            <td>{{ row.cost }}</td>
            <td class="profit-cell">{{ row.profit }}</td>
            <td>{{ row.commission }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
