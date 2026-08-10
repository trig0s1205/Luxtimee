<script setup lang="ts">
import { OrderType } from '@luxtime/shared';

definePageMeta({ middleware: ['admin'], keepalive: true });
</script>

<template>
  <AdminOrdersPanel
    :order-type="OrderType.DETAL"
    title="Pedidos al detal"
    seo-title="Pedidos al detal — LUXTIMEE Admin"
  />
</template>



