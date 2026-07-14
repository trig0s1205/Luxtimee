<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'account' });
const auth = useAuthStore();
</script>

<template>
  <div>
    <h1 class="font-display text-4xl mb-2">Hola, {{ auth.user?.name }}</h1>
    <p class="text-lux-white-dim mb-8">Portal Mi Cuenta — Lote 1 (esqueleto funcional de sesión)</p>
    <AuthGoogleLoginButton v-if="!auth.isAuthenticated" />
    <button
      v-else
      type="button"
      class="text-sm text-lux-gold underline"
      @click="auth.logout()"
    >
      Cerrar sesión
    </button>
  </div>
</template>
