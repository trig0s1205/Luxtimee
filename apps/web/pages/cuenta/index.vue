<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'account' });
const auth = useAuthStore();
</script>

<template>
  <div>
    <AccountAccountNav />
    <h1 class="font-display text-4xl mb-2">Hola, {{ auth.user?.name }}</h1>
    <p class="text-lux-white-dim mb-8">Gestiona tus pedidos, garantías y datos de envío.</p>
    <div class="grid md:grid-cols-2 gap-4">
      <NuxtLink to="/cuenta/pedidos" class="border border-lux-gold/15 p-6 hover:border-lux-gold/40 transition-colors">
        <p class="text-lux-gold text-xs uppercase tracking-widest mb-2">Pedidos</p>
        <p class="text-sm text-lux-white-dim">Historial y recibos digitales</p>
      </NuxtLink>
      <NuxtLink to="/cuenta/garantias" class="border border-lux-gold/15 p-6 hover:border-lux-gold/40 transition-colors">
        <p class="text-lux-gold text-xs uppercase tracking-widest mb-2">Garantías</p>
        <p class="text-sm text-lux-white-dim">Tiempo restante y soporte</p>
      </NuxtLink>
      <NuxtLink to="/cuenta/deseos" class="border border-lux-gold/15 p-6 hover:border-lux-gold/40 transition-colors">
        <p class="text-lux-gold text-xs uppercase tracking-widest mb-2">Deseos</p>
        <p class="text-sm text-lux-white-dim">Relojes guardados</p>
      </NuxtLink>
      <NuxtLink to="/cuenta/datos" class="border border-lux-gold/15 p-6 hover:border-lux-gold/40 transition-colors">
        <p class="text-lux-gold text-xs uppercase tracking-widest mb-2">Checkout exprés</p>
        <p class="text-sm text-lux-white-dim">Dirección y teléfono guardados</p>
      </NuxtLink>
    </div>
    <button type="button" class="mt-8 text-sm text-lux-gold underline" @click="auth.logout()">Cerrar sesión</button>
  </div>
</template>
