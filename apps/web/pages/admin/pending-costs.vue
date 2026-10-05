<script setup lang="ts">
definePageMeta({
  middleware: ['admin', () => navigateTo('/admin/pending-info', { replace: true })],
});
</script>

<template><div /></template>
