<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const chartPeriod = ref<'week' | 'month'>('month');

const mockData = {
  kpis: [
    {
      key: 'sales',
      label: 'Ventas Confirmadas',
      value: '45',
      change: '+10%',
      changeType: 'up' as const,
      alert: false,
    },
    {
      key: 'preorders',
      label: 'Pre-Pedidos Activos',
      value: '12',
      change: 'Requires Attention',
      changeType: 'warning' as const,
      alert: true,
    },
    {
      key: 'views',
      label: 'Vistas Únicas (GA)',
      value: '3.2K',
      change: '+25%',
      changeType: 'up' as const,
      alert: false,
    },
    {
      key: 'conversion',
      label: 'Conversión (GA)',
      value: '18%',
      change: '+2%',
      changeType: 'up' as const,
      alert: false,
    },
  ],
  chart: {
    week: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      traffic: [1200, 1450, 1380, 1620, 1890, 2100, 1980],
      preOrders: [2, 3, 2, 4, 5, 4, 6],
    },
    month: {
      labels: ['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29'],
      traffic: [1800, 2200, 2600, 3100, 3600],
      preOrders: [4, 6, 8, 10, 12],
    },
  },
  alerts: {
    unattended: [
      {
        id: '1',
        model: 'Rolex Daytona Ice Blue',
        waitLabel: '> 2 HORAS EN ESPERA',
      },
    ],
    lowStock: [
      { id: '1', model: 'Omega Speedmaster', left: 1, max: 10, level: 'critical' as const },
      { id: '2', model: 'Patek Nautilus 5711', left: 2, max: 10, level: 'low' as const },
    ],
  },
  topCatalog: [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=120&h=120&fit=crop',
      model: 'Rolex Submariner Date',
      ref: 'Ref. 126610LN',
      views: '1,452',
      stockLabel: 'EN STOCK (8)',
      stockType: 'stock' as const,
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=120&h=120&fit=crop',
      model: 'Omega Speedmaster',
      ref: 'Ref. 310.30.42.50.01.001',
      views: '980',
      stockLabel: 'STOCK BAJO (2)',
      stockType: 'low' as const,
    },
    {
      id: '3',
      image: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=120&h=120&fit=crop',
      model: 'Patek Philippe Nautilus',
      ref: 'Ref. 5711/1A',
      views: '845',
      stockLabel: 'STOCK BAJO (2)',
      stockType: 'low' as const,
    },
  ],
};

const activeChart = computed(() => mockData.chart[chartPeriod.value]);

useSeoMeta({ title: 'Business Health Panel — Luxtime Admin' });
</script>

<template>
  <div class="health-dashboard">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Business Health Panel</h1>
        <p class="health-dashboard-subtitle">Operational overview and traffic analytics</p>
      </div>
      <button type="button" class="health-period-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Hoy
      </button>
    </header>

    <div class="health-kpi-grid">
      <article
        v-for="kpi in mockData.kpis"
        :key="kpi.key"
        class="health-kpi-card"
        :class="{ 'has-alert': kpi.alert }"
      >
        <p class="health-kpi-label">{{ kpi.label }}</p>
        <p class="health-kpi-value">{{ kpi.value }}</p>
        <span class="health-kpi-change" :class="kpi.changeType">
          <template v-if="kpi.changeType === 'up'">↗ {{ kpi.change }}</template>
          <template v-else>{{ kpi.change }}</template>
        </span>
      </article>
    </div>

    <div class="health-main-grid">
      <section class="health-chart-card">
        <div class="health-chart-header">
          <h2 class="health-chart-title">Evolución: Tráfico vs Pre-Pedidos</h2>
          <div class="health-chart-toggle">
            <button type="button" :class="{ active: chartPeriod === 'week' }" @click="chartPeriod = 'week'">
              1 Sem
            </button>
            <button type="button" :class="{ active: chartPeriod === 'month' }" @click="chartPeriod = 'month'">
              1 Mes
            </button>
          </div>
        </div>

        <AdminLineChart
          chart-id="health-chart"
          :labels="activeChart.labels"
          :values="activeChart.traffic"
        />
      </section>

      <aside class="health-alerts-card">
        <h3 class="health-alerts-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          Alertas Operativas
        </h3>

        <div class="health-alert-block">
          <h4>Pre-pedidos sin atender</h4>
          <div v-for="item in mockData.alerts.unattended" :key="item.id" class="health-alert-item">
            <strong>{{ item.model }}</strong>
            <p class="health-alert-wait">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {{ item.waitLabel }}
            </p>
          </div>
        </div>

        <div class="health-alert-block">
          <h4>Inventario Bajo</h4>
          <div v-for="item in mockData.alerts.lowStock" :key="item.id" class="health-stock-item">
            <div class="health-stock-item-header">
              <span>{{ item.model }}</span>
              <span>{{ item.left }} left</span>
            </div>
            <div class="health-stock-bar">
              <div
                class="health-stock-bar-fill"
                :class="item.level"
                :style="{ width: `${(item.left / item.max) * 100}%` }"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>

    <section class="health-table-card">
      <div class="health-table-header">
        <h3>Top Rendimiento de Catálogo (Analytics)</h3>
        <a href="#" class="health-table-link">Ver reporte completo →</a>
      </div>

      <table class="health-table">
        <thead>
          <tr>
            <th>Reloj</th>
            <th>Modelo</th>
            <th>Vistas Totales</th>
            <th>Estado de Inventario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mockData.topCatalog" :key="row.id">
            <td>
              <div class="health-table-watch">
                <img :src="row.image" :alt="row.model" loading="lazy">
              </div>
            </td>
            <td>
              <div class="health-table-model">
                {{ row.model }}
                <span>{{ row.ref }}</span>
              </div>
            </td>
            <td>{{ row.views }}</td>
            <td>
              <span class="health-badge" :class="row.stockType">{{ row.stockLabel }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
