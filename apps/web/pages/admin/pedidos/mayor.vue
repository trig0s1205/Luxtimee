<script setup lang="ts">
import { OrderType } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminOrdersPanel
    :order-type="OrderType.MAYORISTA"
    title="Pedidos al mayor"
    seo-title="Pedidos al mayor — Luxtime Admin"
  />
</template>
