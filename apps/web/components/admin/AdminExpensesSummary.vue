<script setup lang="ts">
import type { ExpenseSummaryDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = withDefaults(defineProps<{
  period?: 'day' | 'week' | 'month' | 'all';
}>(), {
  period: 'month',
});

const api = useApi();
const cacheKey = computed(() => `expenses-summary-${props.period}`);

const { data, pending } = useAdminCachedData(
  cacheKey,
  () => api.get<ExpenseSummaryDto>('/expenses/summary', { period: props.period }).catch(() => null),
  { watch: [cacheKey] },
);

const title = computed(() => {
  if (props.period === 'day') return 'Gastos de hoy';
  if (props.period === 'week') return 'Gastos de la semana';
  if (props.period === 'all') return 'Gastos históricos';
  return 'Gastos del mes';
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <section class="health-table-card">
    <div class="health-table-header">
      <h3>{{ title }}</h3>
      <NuxtLink to="/admin/gastos" class="health-table-link">Ver gastos →</NuxtLink>
    </div>
    <article class="health-kpi-card">
      <p class="health-kpi-label">{{ title }}</p>
      <p class="health-kpi-value">{{ pending && !data ? 'Cargando...' : formatCop(data?.total ?? 0) }}</p>
      <p class="health-kpi-subtitle">Estos gastos no se restan de la ganancia.</p>
    </article>
    <table class="health-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Nombre</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!data?.items.length">
          <td colspan="3">Sin gastos en este periodo.</td>
        </tr>
        <tr v-for="expense in data?.items" :key="expense.id">
          <td>{{ formatDate(expense.spentAt) }}</td>
          <td>
            {{ expense.name }}
            <span v-if="expense.description" class="admin-record-muted"> · {{ expense.description }}</span>
          </td>
          <td>{{ formatCop(expense.amount) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
