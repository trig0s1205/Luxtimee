<script setup lang="ts">
import { OrderType } from '@luxtime/shared';

definePageMeta({ middleware: ['admin'], keepalive: true });
</script>

<template>
  <AdminOrdersPanel
    :order-type="OrderType.MAYORISTA"
    title="Pedidos al mayor"
    seo-title="Pedidos al mayor — LUXTIMEE Admin"
  />
</template>



