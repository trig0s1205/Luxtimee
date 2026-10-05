<script setup lang="ts">
definePageMeta({
  middleware: ['admin', () => navigateTo('/admin/configuracion', { replace: true })],
});
</script>

<template><div /></template>
