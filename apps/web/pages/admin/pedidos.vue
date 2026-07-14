<script setup lang="ts">
import type { OrderDto, OrderStatus } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const statuses: OrderStatus[] = ['PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];

const { data: orders, refresh } = await useAsyncData('admin-orders', () =>
  api.get<OrderDto[]>('/orders').catch(() => []),
);

async function transition(id: string, status: OrderStatus) {
  await api.patch(`/orders/${id}/status`, { status });
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Ventas" title="Pedidos" />
    <div class="space-y-4">
      <article v-for="order in orders" :key="order.id" class="border border-lux-gold/15 p-5">
        <div class="flex flex-wrap justify-between gap-2 mb-2">
          <h3 class="font-display text-xl">{{ order.readableId }}</h3>
          <div class="flex gap-2">
            <UiLuxBadge tone="gold">{{ order.status }}</UiLuxBadge>
            <UiLuxBadge :tone="order.type === 'MAYORISTA' ? 'mayorista' : 'detal'">{{ order.type }}</UiLuxBadge>
          </div>
        </div>
        <p class="text-sm text-lux-white-dim mb-2">{{ order.customerName }}</p>
        <p class="text-lux-gold mb-4">{{ formatCop(order.total) }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="status in statuses"
            :key="status"
            type="button"
            class="px-3 py-1 text-[10px] uppercase tracking-widest border border-lux-gold/25 hover:border-lux-gold"
            @click="transition(order.id, status)"
          >
            → {{ status }}
          </button>
        </div>
      </article>
      <p v-if="!orders?.length" class="text-lux-white-dim">No hay pedidos confirmados.</p>
    </div>
  </div>
</template>
