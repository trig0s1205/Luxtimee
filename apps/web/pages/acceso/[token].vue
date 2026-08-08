<script setup lang="ts">
definePageMeta({ middleware: ['staff-login-token', 'guest'] });

useHead({ htmlAttrs: { lang: 'es' } });

const route = useRoute();
const redirect = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : null,
);

useSeoMeta({
  title: 'Iniciar sesión — LUXTIMEE',
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div class="auth-page">
    <AuthLoginPanel :redirect="redirect" />
  </div>
</template>
