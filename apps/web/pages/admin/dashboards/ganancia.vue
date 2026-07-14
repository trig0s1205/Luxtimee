<script setup lang="ts">
import type { ProfitDashboardDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const auth = useAuthStore();
const period = ref<'day' | 'week' | 'month' | 'all'>('month');
const config = useRuntimeConfig();

if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

const { data: dashboard, refresh } = await useAsyncData(
  'profit-dashboard',
  () => api.get<ProfitDashboardDto>('/dashboards/profit', { period: period.value }),
  { watch: [period] },
);
</script>

<template>
  <div>
    <UiSectionHeader label="Finanzas" title="Dashboard de ganancia" />
    <select v-model="period" class="mb-6 bg-lux-black-2 border border-lux-gold/20 px-4 py-2 text-sm">
      <option value="day">Hoy</option>
      <option value="week">Semana</option>
      <option value="month">Mes</option>
      <option value="all">Total</option>
    </select>

    <div v-if="dashboard" class="grid md:grid-cols-4 gap-4 mb-8">
      <div class="border border-lux-gold/15 p-4"><p class="text-xs text-lux-white-dim">Ingresos</p><p class="font-display text-2xl text-lux-gold">{{ formatCop(dashboard.totalRevenue) }}</p></div>
      <div class="border border-lux-gold/15 p-4"><p class="text-xs text-lux-white-dim">Costos</p><p class="font-display text-2xl">{{ formatCop(dashboard.totalCost) }}</p></div>
      <div class="border border-lux-gold/15 p-4"><p class="text-xs text-lux-white-dim">Ganancia</p><p class="font-display text-2xl text-lux-gold">{{ formatCop(dashboard.totalProfit) }}</p></div>
      <div class="border border-lux-gold/15 p-4"><p class="text-xs text-lux-white-dim">Comisión</p><p class="font-display text-2xl">{{ formatCop(dashboard.totalCommission) }}</p></div>
    </div>

    <div class="flex gap-4 mb-8">
      <a :href="`${config.public.apiBaseUrl}/dashboards/profit/export/excel?period=${period}`" class="text-xs uppercase tracking-widest text-lux-gold" target="_blank">Exportar Excel</a>
      <a :href="`${config.public.apiBaseUrl}/dashboards/profit/export/pdf?period=${period}`" class="text-xs uppercase tracking-widest text-lux-gold" target="_blank">Exportar PDF</a>
    </div>

    <div class="overflow-x-auto border border-lux-gold/10">
      <table class="w-full text-sm">
        <thead class="text-left text-[10px] uppercase tracking-widest text-lux-white-dim border-b border-lux-gold/10">
          <tr><th class="p-3">Pedido</th><th class="p-3">Producto</th><th class="p-3">Ganancia</th><th class="p-3">%</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in dashboard?.items" :key="`${item.orderId}-${item.productName}`" class="border-b border-lux-gold/5">
            <td class="p-3">{{ item.readableId }}</td>
            <td class="p-3">{{ item.productName }}</td>
            <td class="p-3 text-lux-gold">{{ formatCop(item.profit) }}</td>
            <td class="p-3">{{ item.profitPercent }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
