<script setup lang="ts">
import type { OrderDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const { data: preOrders, refresh } = await useAsyncData('admin-pre-orders', () =>
  api.get<OrderDto[]>('/pre-orders').catch(() => []),
);

async function confirmDeposit(id: string) {
  await api.post(`/pre-orders/${id}/confirm-deposit`);
  await refresh();
}

async function cancelOrder(id: string) {
  await api.post(`/pre-orders/${id}/cancel`);
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Ventas" :title="`Pre-pedidos (${preOrders?.length ?? 0})`" />
    <div class="space-y-4">
      <article v-for="order in preOrders" :key="order.id" class="border border-lux-gold/15 p-5 space-y-3">
        <div class="flex flex-wrap justify-between gap-2">
          <h3 class="font-display text-xl">{{ order.readableId }}</h3>
          <UiLuxBadge :tone="order.type === 'MAYORISTA' ? 'mayorista' : 'detal'">{{ order.type }}</UiLuxBadge>
        </div>
        <p class="text-sm text-lux-white-dim">{{ order.customerName }} · {{ order.customerEmail }}</p>
        <p class="text-sm">{{ order.customerAddress }}</p>
        <p class="text-lux-gold">Total {{ formatCop(order.total) }} · Abono esperado {{ formatCop(order.depositExpected) }}</p>
        <ul class="text-sm text-lux-white-dim">
          <li v-for="item in order.items" :key="item.id">{{ item.productName }} x{{ item.quantity }}</li>
        </ul>
        <div class="flex gap-3">
          <UiLuxButton @click="confirmDeposit(order.id)">Confirmar abono</UiLuxButton>
          <UiLuxButton variant="ghost" @click="cancelOrder(order.id)">Anular</UiLuxButton>
        </div>
      </article>
      <p v-if="!preOrders?.length" class="text-lux-white-dim">No hay pre-pedidos activos.</p>
    </div>
  </div>
</template>
