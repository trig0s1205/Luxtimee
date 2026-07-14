<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
await navigateTo('/admin/inventario');
</script>

<template><div /></template>
