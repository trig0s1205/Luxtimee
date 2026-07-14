<script setup lang="ts">
const { loginWithGoogle, mockLogin } = useAuth();

async function devLogin() {
  await mockLogin('cliente@luxtime.co', 'Cliente Demo');
  await navigateTo('/cuenta');
}
</script>

<template>
  <div class="space-y-3">
    <button
      type="button"
      class="w-full border border-lux-gold/30 px-6 py-3 text-sm uppercase tracking-widest hover:bg-lux-gold hover:text-lux-black transition-colors"
      @click="loginWithGoogle"
    >
      Continuar con Google
    </button>
    <button
      type="button"
      class="w-full text-xs text-lux-white-dim underline"
      @click="devLogin"
    >
      Login demo (solo desarrollo)
    </button>
  </div>
</template>
