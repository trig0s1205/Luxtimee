<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

await navigateTo('/admin/inventario', { replace: true });
</script>

<template><div /></template>
