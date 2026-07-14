<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'role'], layout: 'admin' });
</script>

<template>
  <div>
    <h2 class="font-display text-3xl mb-4">Panel Admin</h2>
    <p class="text-lux-white-dim">Estructura base del panel — inventario y pedidos en Lote 2.</p>
  </div>
</template>
