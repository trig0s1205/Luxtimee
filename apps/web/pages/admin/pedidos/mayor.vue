<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminOrdersPanel
    order-type="MAYORISTA"
    title="Pedidos al mayor"
    seo-title="Pedidos al mayor — Luxtime Admin"
  />
</template>
