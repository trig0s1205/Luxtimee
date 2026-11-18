<script setup lang="ts">
import { OrderSource, OrderType } from '@luxtime/shared';

definePageMeta({ middleware: ['admin'], keepalive: true });
</script>

<template>
  <AdminOrdersPanel
    :order-type="OrderType.DETAL"
    :source="OrderSource.LOCAL"
    title="Ventas en el local"
    seo-title="Ventas en el local — LUXTIMEE Admin"
  />
</template>
