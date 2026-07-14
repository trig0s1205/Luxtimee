<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'account' });

const api = useApi();
const config = useRuntimeConfig();

interface WarrantyRow {
  orderId: string;
  readableId: string;
  productName: string;
  remainingDays: number;
  endsAt: string;
}

const { data: warranties } = await useAsyncData('my-warranties', () =>
  api.get<WarrantyRow[]>('/account/warranties'),
);

function supportUrl(item: WarrantyRow) {
  const msg = encodeURIComponent(
    `Hola Luxtime, solicito soporte de garantía.\nPedido: ${item.readableId}\nModelo: ${item.productName}`,
  );
  return `https://wa.me/573000000000?text=${msg}`;
}
</script>

<template>
  <div>
    <AccountAccountNav />
    <UiSectionHeader label="Mi cuenta" title="Garantías digitales" />
    <div class="space-y-4">
      <article v-for="(item, idx) in warranties" :key="`${item.orderId}-${idx}`" class="border border-lux-gold/15 p-5">
        <h3 class="font-display text-xl mb-1">{{ item.productName }}</h3>
        <p class="text-sm text-lux-white-dim mb-2">Pedido {{ item.readableId }}</p>
        <p class="text-lux-gold mb-4">{{ item.remainingDays }} días restantes (hasta {{ new Date(item.endsAt).toLocaleDateString('es-CO') }})</p>
        <a :href="supportUrl(item)" target="_blank" rel="noopener">
          <UiLuxButton variant="ghost">Soporte de garantía</UiLuxButton>
        </a>
      </article>
      <p v-if="!warranties?.length" class="text-lux-white-dim">No tienes garantías activas.</p>
    </div>
  </div>
</template>
