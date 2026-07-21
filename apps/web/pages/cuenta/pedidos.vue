<script setup lang="ts">
import type { OrderDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['auth'], layout: 'account' });

const api = useApi();
const { data: orders } = await useAsyncData('my-orders', () => api.get<OrderDto[]>('/account/orders'));
const { t, dateLocale } = useLocale();
const selectedReceipt = ref<Record<string, unknown> | null>(null);

async function viewReceipt(orderId: string) {
  selectedReceipt.value = await api.get(`/account/orders/${orderId}/receipt`);
}
</script>

<template>
  <div>
    <AccountAccountNav />
    <UiSectionHeader :label="t('account.myAccount')" :title="t('account.orderHistory')" />
    <div class="space-y-4">
      <article v-for="order in orders" :key="order.id" class="border border-lux-gold/15 p-5">
        <div class="flex justify-between flex-wrap gap-2 mb-2">
          <h3 class="font-display text-xl">{{ order.readableId }}</h3>
          <UiLuxBadge tone="gold">{{ order.status }}</UiLuxBadge>
        </div>
        <p class="text-lux-gold font-display text-lg mb-2">{{ formatCop(order.total) }}</p>
        <p class="text-sm text-lux-white-dim mb-3">{{ new Date(order.createdAt).toLocaleDateString(dateLocale) }}</p>
        <button type="button" class="text-xs uppercase tracking-widest text-lux-gold" @click="viewReceipt(order.id)">{{ t('account.viewReceipt') }}</button>
      </article>
      <p v-if="!orders?.length" class="text-lux-white-dim">{{ t('account.noOrders') }}</p>
    </div>
    <div v-if="selectedReceipt" class="mt-8 border border-lux-gold/30 p-6 text-sm space-y-2">
      <h4 class="font-display text-2xl text-lux-gold mb-4">{{ t('account.digitalReceipt') }}</h4>
      <p><strong>{{ t('account.order') }}:</strong> {{ selectedReceipt.readableId }}</p>
      <p><strong>{{ t('account.total') }}:</strong> {{ formatCop(selectedReceipt.total as number) }}</p>
      <ul class="mt-2">
        <li v-for="(item, idx) in (selectedReceipt.items as Array<Record<string, unknown>>)" :key="idx">
          {{ item.productName }} x{{ item.quantity }} — {{ formatCop(item.lineTotal as number) }}
        </li>
      </ul>
    </div>
  </div>
</template>
