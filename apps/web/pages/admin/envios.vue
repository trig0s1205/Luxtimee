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
    <div class="shipping-zones-list">
      <div v-for="zone in zones" :key="zone.id" class="shipping-zone-row">
        <div class="shipping-zone-info">
          <p class="font-display">{{ zone.name }}</p>
          <p class="shipping-zone-type">{{ zone.isNational ? 'Nacional' : 'Metropolitana' }}</p>
        </div>
        <input
          type="number"
          class="shipping-zone-input"
          :value="zone.cost"
          @change="save(zone, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="shipping-zone-price">{{ formatCop(zone.cost) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shipping-zones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 36rem;
}

.shipping-zone-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: var(--border-hairline);
  background: rgba(255, 255, 255, 0.02);
}

.shipping-zone-info {
  flex: 1;
}

.shipping-zone-type {
  font-size: 12px;
  color: var(--lux-white-dim);
}

.shipping-zone-input {
  width: 8rem;
  background: transparent;
  border: var(--border-hairline);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--lux-white);
  outline: none;
}

.shipping-zone-input:focus {
  border-color: rgba(200, 169, 110, 0.22);
}

.shipping-zone-price {
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
