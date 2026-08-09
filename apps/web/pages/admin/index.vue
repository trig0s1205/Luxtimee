<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
await navigateTo(auth.isSuperAdmin ? '/admin/dashboards/ganancia' : '/admin/dashboards/salud');
</script>

<template><div /></template>
