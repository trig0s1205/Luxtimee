<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminPreOrdersPanel
    bucket="active"
    title="Pre-pedidos activos"
    seo-title="Pre-pedidos activos — Luxtime Admin"
  />
</template>
