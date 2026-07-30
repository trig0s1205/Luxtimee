<script setup lang="ts">
import { OrderType } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminOrdersPanel
    :order-type="OrderType.DETAL"
    title="Pedidos al detal"
    seo-title="Pedidos al detal — Luxtime Admin"
  />
</template>
