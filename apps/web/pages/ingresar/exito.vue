<script setup lang="ts">
definePageMeta({ layout: false });

useHead({ htmlAttrs: { lang: 'es' } });

const { completeLogin } = useAuth();
const error = ref('');
const loading = ref(true);

useSeoMeta({
  title: 'Sesión iniciada — Luxtime',
  robots: 'noindex, nofollow',
});

onMounted(async () => {
  try {
    const destination = await completeLogin();
    if (!destination) {
      error.value = 'No se pudo validar la sesión. Intenta iniciar sesión de nuevo.';
      loading.value = false;
    }
  } catch {
    error.value = 'Error al completar el inicio de sesión.';
    loading.value = false;
  }
});
</script>

<template>
  <div class="auth-page">
    <div v-if="loading" class="auth-card auth-card--center reveal visible">
      <p class="auth-eyebrow">Luxtime</p>
      <h1 class="auth-title">Validando <em>acceso</em></h1>
      <div class="auth-loader" />
    </div>

    <div v-else class="auth-card auth-card--center reveal visible">
      <p class="auth-alert auth-alert--error">{{ error }}</p>
      <NuxtLink to="/ingresar" class="btn-primary auth-submit">Volver a ingresar</NuxtLink>
    </div>
  </div>
</template>
