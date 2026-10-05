<script setup lang="ts">
definePageMeta({
  middleware: ['admin', () => navigateTo('/admin/inventario', { replace: true })],
});
</script>

<template><div /></template>
