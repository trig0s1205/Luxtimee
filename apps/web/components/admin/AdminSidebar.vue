<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const links = [
  { to: '/admin/inventario', label: 'Inventario' },
  { to: '/admin/importar', label: 'Importar Excel' },
  { to: '/admin/garantias', label: 'Garantías' },
  { to: '/admin/cuidados', label: 'Cuidados' },
  { to: '/admin/envios', label: 'Envíos' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
  { to: '/admin/pre-pedidos', label: 'Pre-pedidos' },
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/notificaciones', label: 'Notificaciones' },
  { to: '/admin/dashboards/ganancia', label: 'Ganancia', superOnly: true },
  { to: '/admin/dashboards/salud', label: 'Salud del negocio', superOnly: true },
];

const route = useRoute();
const auth = useAuthStore();
</script>

<template>
  <aside class="hidden lg:block w-64 border-r border-lux-gold/10 p-8 shrink-0">
    <p class="font-display text-2xl text-lux-gold mb-8">Admin</p>
    <nav class="space-y-2 text-sm">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="block py-2 px-3 transition-colors"
        :class="[
          route.path.startsWith(link.to) ? 'text-lux-gold border-l border-lux-gold' : 'text-lux-white-dim hover:text-lux-white',
          link.superOnly && !auth.isSuperAdmin ? 'hidden' : '',
        ]"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>
