<script setup lang="ts">
const links = [
  { to: '/cuenta', label: 'Resumen' },
  { to: '/cuenta/pedidos', label: 'Pedidos' },
  { to: '/cuenta/garantias', label: 'Garantías' },
  { to: '/cuenta/deseos', label: 'Lista de deseos' },
  { to: '/cuenta/datos', label: 'Datos de envío' },
];
const route = useRoute();
</script>

<template>
  <nav class="flex flex-wrap gap-4 mb-10 border-b border-lux-gold/15 pb-4">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="text-[11px] uppercase tracking-widest pb-2 border-b-2 transition-colors"
      :class="route.path === link.to ? 'text-lux-gold border-lux-gold' : 'text-lux-white-dim border-transparent hover:text-lux-white'"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
