<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
if (!auth.loaded) {
  await auth.fetchMe();
}

await navigateTo(auth.isSuperAdmin ? '/admin/dashboards/ganancia' : '/admin/dashboards/salud');
</script>

<template><div /></template>
