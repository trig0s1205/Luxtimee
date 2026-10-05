<script setup lang="ts">
definePageMeta({
  middleware: ['admin', () => navigateTo('/admin/pedidos/detal', { replace: true })],
});
</script>

<template><div /></template>
