<script setup lang="ts">
definePageMeta({
  middleware: ['admin', () => {
    const auth = useAuthStore();
    return navigateTo(auth.isLocalSeller ? '/admin/pos' : '/admin/inventario', { replace: true });
  }],
});
</script>

<template><div /></template>
