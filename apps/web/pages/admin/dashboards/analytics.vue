<script setup lang="ts">
import type { Ga4EngagementDto, Ga4StatusDto } from '@luxtime/shared';
import { ADMIN_CACHE_MS } from '~/utils/admin-cache';
import { extractApiErrorMessage } from '~/utils/api-error';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();

const {
  data: status,
  pending: statusPending,
  error: statusError,
  refresh: refreshStatus,
} = useAdminCachedData(
  'analytics-status',
  () => api.get<Ga4StatusDto>('/dashboards/analytics/status'),
  { staleTime: ADMIN_CACHE_MS.dashboards },
);

const {
  data: analytics,
  pending: analyticsPending,
  error: analyticsError,
  refresh: refreshAnalytics,
} = useAdminCachedData(
  'analytics-dashboard',
  () => api.get<Ga4EngagementDto>('/dashboards/analytics'),
  { staleTime: ADMIN_CACHE_MS.dashboards },
);

const pending = computed(() => statusPending.value || analyticsPending.value);

const loadError = computed(() => {
  if (statusError.value) {
    return extractApiErrorMessage(statusError.value, 'No se pudo consultar el estado de GA4.');
  }
  if (analyticsError.value) {
    return extractApiErrorMessage(analyticsError.value, 'No se pudieron cargar las métricas.');
  }
  return null;
});

function refresh() {
  void refreshStatus();
  void refreshAnalytics();
}

onMounted(() => {
  if (!status.value && !analytics.value) {
    refresh();
  }
});

useSeoMeta({ title: 'Tráfico web — LUXTIMEE Admin' });
</script>

<template>
  <div class="health-dashboard">
    <header class="health-dashboard-header">
      <div>
        <h1 class="health-dashboard-title">Tráfico web</h1>
        <p class="health-dashboard-subtitle">Google Analytics 4 · últimos 30 días</p>
      </div>
      <button type="button" class="health-period-btn" :disabled="pending" @click="refresh()">
        {{ pending ? 'Actualizando...' : 'Actualizar' }}
      </button>
    </header>

    <section v-if="loadError" class="analytics-status analytics-status--error">
      <p class="analytics-status-title">No se pudo cargar el panel</p>
      <p class="analytics-status-error">{{ loadError }}</p>
      <p class="analytics-status-meta">Verifica que la API esté desplegada y que los secrets GA4 existan en Cloud Run.</p>
    </section>

    <section v-else-if="status" class="analytics-status" :class="status.connected ? 'analytics-status--ok' : 'analytics-status--error'">
      <p class="analytics-status-title">
        {{ status.connected ? 'GA4 conectado' : status.configured ? 'GA4 configurado pero sin conexión' : 'GA4 no configurado en la API' }}
      </p>
      <p v-if="status.propertyId" class="analytics-status-meta">Propiedad: {{ status.propertyId }}</p>
      <p v-if="status.clientEmail" class="analytics-status-meta">{{ status.clientEmail }}</p>
      <p v-if="status.error" class="analytics-status-error">{{ status.error }}</p>
      <p v-else-if="analytics?.source === 'mock'" class="analytics-status-meta">Datos de ejemplo — faltan credenciales GA4 en Cloud Run.</p>
      <p v-else-if="analytics?.source === 'live'" class="analytics-status-meta">Datos reales de Google Analytics.</p>
    </section>

    <div v-if="pending && !analytics" class="health-kpi-grid">
      <article v-for="i in 4" :key="i" class="health-kpi-card">Cargando...</article>
    </div>

    <div v-else-if="analytics?.metrics?.length" class="health-kpi-grid">
      <article v-for="metric in analytics.metrics" :key="metric.key" class="health-kpi-card">
        <p class="health-kpi-label">{{ metric.label }}</p>
        <p class="health-kpi-value">{{ metric.current.toLocaleString('es-CO') }}</p>
        <span class="health-kpi-change" :class="metric.changePercent >= 0 ? 'up' : 'warning'">
          {{ metric.changePercent > 0 ? '+' : '' }}{{ metric.changePercent }}% vs periodo anterior
        </span>
      </article>
    </div>

    <p v-if="analytics?.error" class="analytics-status-error analytics-status-error--inline">
      {{ analytics.error }}
    </p>
  </div>
</template>

<style scoped>
.analytics-status {
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(200, 169, 110, 0.2);
  border-radius: 4px;
  background: rgba(200, 169, 110, 0.05);
}

.analytics-status--ok {
  border-color: rgba(88, 196, 130, 0.35);
  background: rgba(88, 196, 130, 0.08);
}

.analytics-status--error {
  border-color: rgba(255, 120, 120, 0.35);
  background: rgba(255, 120, 120, 0.08);
}

.analytics-status-title {
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--white);
  margin-bottom: 0.35rem;
}

.analytics-status-meta {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--white-dim);
}

.analytics-status-error {
  margin-top: 0.5rem;
  font-family: var(--font-body);
  font-size: 12px;
  color: #ffb4b4;
}

.analytics-status-error--inline {
  margin-top: 1rem;
}
</style>
