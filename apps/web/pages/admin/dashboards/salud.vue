<script setup lang="ts">
import type { HealthDashboardDto } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const auth = useAuthStore();

if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

const { data } = await useAsyncData('health-dashboard', () =>
  api.get<HealthDashboardDto & { business: Record<string, number> }>('/dashboards/health'),
);
</script>

<template>
  <div>
    <UiSectionHeader label="Finanzas" title="Salud del negocio" />
    <p class="text-sm text-lux-white-dim mb-8 -mt-4">{{ data?.periodLabel }}</p>

    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <div v-for="metric in data?.metrics" :key="metric.key" class="border border-lux-gold/15 p-4">
        <p class="text-xs text-lux-white-dim">{{ metric.label }}</p>
        <p class="font-display text-3xl">{{ metric.current }}</p>
        <p class="text-sm" :class="metric.changePercent >= 0 ? 'text-green-400' : 'text-red-400'">
          {{ metric.changePercent > 0 ? '+' : '' }}{{ metric.changePercent }}%
        </p>
      </div>
    </div>

    <div class="grid md:grid-cols-4 gap-4">
      <div v-for="(value, key) in data?.business" :key="key" class="border border-lux-gold/15 p-4">
        <p class="text-xs uppercase tracking-widest text-lux-white-dim">{{ key }}</p>
        <p class="font-display text-2xl text-lux-gold">{{ value }}</p>
      </div>
    </div>
  </div>
</template>
