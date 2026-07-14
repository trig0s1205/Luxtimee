<script setup lang="ts">
import type { ShippingZoneDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const { data: zones, refresh } = await useAsyncData('admin-zones', () =>
  api.get<ShippingZoneDto[]>('/shipping-zones').catch(() => []),
);

async function save(zone: ShippingZoneDto, cost: number) {
  await api.patch(`/shipping-zones/${zone.id}`, { cost });
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Operaciones" title="Tarifas de envío" />
    <div class="space-y-3 max-w-xl">
      <div v-for="zone in zones" :key="zone.id" class="flex items-center gap-4 border border-lux-gold/15 p-4">
        <div class="flex-1">
          <p class="font-display">{{ zone.name }}</p>
          <p class="text-xs text-lux-white-dim">{{ zone.isNational ? 'Nacional' : 'Metropolitana' }}</p>
        </div>
        <input
          type="number"
          class="w-32 bg-transparent border border-lux-gold/25 px-3 py-2 text-sm"
          :value="zone.cost"
          @change="save(zone, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="text-xs text-lux-white-dim">{{ formatCop(zone.cost) }}</span>
      </div>
    </div>
  </div>
</template>
