<script setup lang="ts">
definePageMeta({ middleware: ['admin'], keepalive: true });
useSeoMeta({ title: 'Ventas — LUXTIMEE Admin' });
</script>

<template>
  <AdminDeliveredSalesTable />
</template>
