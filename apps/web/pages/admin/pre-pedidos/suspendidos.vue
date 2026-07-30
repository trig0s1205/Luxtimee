<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
</script>

<template>
  <AdminPreOrdersPanel
    bucket="suspended"
    title="Pre-pedidos suspendidos"
    seo-title="Pre-pedidos suspendidos — Luxtime Admin"
  />
</template>
