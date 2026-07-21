<script setup lang="ts">
const { loginWithGoogle, mockLogin } = useAuth();
const route = useRoute();

const redirect = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : null,
);

async function devLogin() {
  await mockLogin('cliente@luxtime.co', 'Cliente Demo');
  const { redirectAfterLogin, auth } = useAuth();
  await navigateTo(redirectAfterLogin(auth.user!, redirect.value));
}
</script>

<template>
  <div class="space-y-3">
    <button type="button" class="btn-primary w-full" @click="loginWithGoogle(redirect ?? undefined)">
      Continuar con Google
    </button>
    <button type="button" class="btn-ghost w-full text-xs" @click="devLogin">
      Login demo (solo desarrollo)
    </button>
  </div>
</template>
