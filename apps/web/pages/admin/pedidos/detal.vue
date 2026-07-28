<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminOrdersPanel
    order-type="DETAL"
    title="Pedidos al detal"
    seo-title="Pedidos al detal — Luxtime Admin"
  />
</template>
