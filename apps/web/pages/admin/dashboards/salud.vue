<script setup lang="ts">
import type { HealthDashboardDto } from '@luxtime/shared';
import { GLOBAL_INVENTORY_LOW_THRESHOLD } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { ADMIN_CACHE_MS } from '~/utils/admin-cache';

const AdminDashboardChartLazy = defineAsyncComponent(() => import('~/components/admin/DashboardChart.vue'));

definePageMeta({ middleware: ['admin'], keepalive: true });

const auth = useAuthStore();
const api = useApi();
const { waitHoursSince } = useLiveWaitHours();

const { data: health, pending, refresh } = useAdminCachedData(
  'health-dashboard',
  () => api.get<HealthDashboardDto>('/dashboards/health?period=month'),
  { staleTime: ADMIN_CACHE_MS.dashboards },
);

type KpiCard = {
  key: string;
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'warning';
  alert: boolean;
};

const kpis = computed<KpiCard[]>(() => {
  const data = health.value;
  if (!data) return [];

  const revenueChange = data.business.previousPeriodRevenue > 0
    ? Math.round(
        ((data.business.periodRevenue - data.business.previousPeriodRevenue)
          / data.business.previousPeriodRevenue) * 100,
      )
    : data.business.periodRevenue > 0
      ? 100
      : 0;

  return [
    {
      key: 'paidOrders',
      label: 'Ventas Confirmadas',
      value: String(data.business.paidOrders),
      change: 'Pagadas, enviadas o entregadas',
      changeType: 'up',
      alert: false,
    },
    {
      key: 'preOrders',
      label: 'Pre-Pedidos Activos',
      value: String(data.business.activePreOrders),
      change: data.business.suspendedPreOrders
        ? `${data.business.suspendedPreOrders} suspendidos`
        : 'Sin suspendidos',
      changeType: data.business.suspendedPreOrders ? 'warning' : 'up',
      alert: data.unattendedPreOrders.length > 0 || data.suspendedPreOrders.length > 0 || data.inventoryAlert.isLow,
    },
    {
      key: 'ordersToShip',
      label: 'Por enviar',
      value: String(data.business.ordersToShip),
      change: data.business.ordersToShip ? 'Pagados, pendientes de despacho' : 'Al día',
      changeType: data.business.ordersToShip ? 'warning' : 'up',
      alert: data.business.ordersToShip > 0,
    },
    {
      key: 'periodRevenue',
      label: 'Ingresos',
      value: formatCop(data.business.periodRevenue),
      change: data.period === 'all'
        ? `${data.business.unitsSold} unidades vendidas`
        : `${revenueChange > 0 ? '+' : ''}${revenueChange}% vs periodo anterior`,
      changeType: revenueChange >= 0 ? 'up' : 'warning',
      alert: false,
    },
  ];
});

useSeoMeta({ title: 'Panel de salud del negocio — LUXTIMEE Admin' });
</script>

<template>
  <div class="health-dashboard">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Panel de salud del negocio</h1>
        <p class="health-dashboard-subtitle">Resumen operativo en tiempo real</p>
      </div>
      <button type="button" class="health-period-btn" :disabled="pending" @click="refresh()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
        {{ pending ? 'Actualizando...' : 'Actualizar' }}
      </button>
    </header>

    <div v-if="pending && !health" class="health-kpi-grid">
      <article v-for="i in 4" :key="i" class="health-kpi-card">Cargando...</article>
    </div>

    <div v-else class="health-kpi-grid">
      <article
        v-for="kpi in kpis"
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
      <AdminDashboardChartLazy />

      <aside class="health-alerts-card">
        <h3 class="health-alerts-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          Alertas Operativas
        </h3>

        <div class="health-alert-block">
          <h4>Pre-pedidos</h4>

          <div class="health-alert-subsection">
            <p class="health-alert-summary" :class="{ warning: (health?.suspendedPreOrders.length ?? 0) > 0 }">
              {{ health?.business.suspendedPreOrders ?? 0 }} pre-pedido{{ (health?.business.suspendedPreOrders ?? 0) === 1 ? '' : 's' }} suspendido{{ (health?.business.suspendedPreOrders ?? 0) === 1 ? '' : 's' }}
            </p>
            <p class="health-alert-hint">El cliente abandonó la conversación por más de 24 horas.</p>
            <p v-if="!health?.suspendedPreOrders.length" class="health-alert-empty">Sin suspendidos.</p>
            <div v-for="item in health?.suspendedPreOrders" :key="item.id" class="health-alert-item">
              <strong>{{ item.model }}</strong>
              <p class="health-alert-wait">
                {{ item.readableId }} · suspendido hace {{ waitHoursSince(item.activeSince) }}h
              </p>
            </div>
            <NuxtLink
              v-if="(health?.business.suspendedPreOrders ?? 0) > 0"
              to="/admin/pre-pedidos/suspendidos"
              class="health-table-link"
            >
              Ver suspendidos →
            </NuxtLink>
          </div>

          <div class="health-alert-subsection">
            <p
              class="health-alert-summary"
              :class="{ critical: (health?.business.longWaitingPreOrders ?? 0) > 0 }"
            >
              {{ health?.business.longWaitingPreOrders ?? 0 }} pre-pedido{{ (health?.business.longWaitingPreOrders ?? 0) === 1 ? '' : 's' }} con más de 1 hora en espera
            </p>
            <p class="health-alert-hint">Requieren atención prioritaria antes de las 24 horas.</p>
            <p v-if="!health?.unattendedPreOrders.length" class="health-alert-empty">Sin pre-pedidos críticos.</p>
            <div
              v-for="item in health?.unattendedPreOrders"
              :key="item.id"
              class="health-alert-item health-alert-item--critical"
            >
              <strong>{{ item.model }}</strong>
              <p class="health-alert-wait">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {{ item.readableId }} · {{ waitHoursSince(item.activeSince) }}h en espera
              </p>
            </div>
            <NuxtLink
              v-if="(health?.business.longWaitingPreOrders ?? 0) > 0"
              to="/admin/pre-pedidos/activos"
              class="health-table-link"
            >
              Ver activos →
            </NuxtLink>
          </div>
        </div>

        <div class="health-alert-block" :class="{ 'health-alert-block--critical': health?.inventoryAlert.isLow }">
          <h4>Inventario general</h4>
          <p
            class="health-alert-summary"
            :class="{ critical: health?.inventoryAlert.isLow }"
          >
            {{ health?.inventoryAlert.totalUnits ?? 0 }} unidades en stock
          </p>
          <p class="health-alert-hint">
            Alerta roja si el total es {{ GLOBAL_INVENTORY_LOW_THRESHOLD }} unidades o menos.
          </p>
          <div v-if="health?.inventoryAlert.isLow" class="health-alert-item health-alert-item--critical">
            <strong>Inventario bajo</strong>
            <p class="health-alert-wait">
              Quedan {{ health.inventoryAlert.totalUnits }} de {{ health.inventoryAlert.threshold }} unidades recomendadas.
            </p>
          </div>
          <p v-else class="health-alert-empty">Nivel de inventario dentro del rango.</p>
          <NuxtLink to="/admin/inventario" class="health-table-link">
            Ver inventario →
          </NuxtLink>
        </div>
      </aside>
    </div>

    <section class="health-table-card">
      <div class="health-table-header">
        <h3>Más vendidos (por unidades)</h3>
        <NuxtLink to="/admin/inventario" class="health-table-link">Ver inventario completo →</NuxtLink>
      </div>

      <table class="health-table">
        <thead>
          <tr>
            <th>Reloj</th>
            <th>Modelo</th>
            <th>Unidades vendidas</th>
            <th>Estado de Inventario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!health?.topWatches.length">
            <td colspan="4">Aún no hay ventas registradas.</td>
          </tr>
          <tr v-for="row in health?.topWatches" :key="row.id">
            <td>
              <div class="health-table-watch">
                <img v-if="row.image" :src="row.image" :alt="row.model" loading="lazy">
              </div>
            </td>
            <td>
              <div class="health-table-model">
                {{ row.brand }} {{ row.model }}
                <span v-if="row.reference">Ref. {{ row.reference }}</span>
              </div>
            </td>
            <td>{{ row.unitsSold }}</td>
            <td>
              <span class="health-badge" :class="row.stock === 0 ? 'low' : 'stock'">
                {{ row.stock === 0 ? 'AGOTADO' : `EN STOCK (${row.stock})` }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>



