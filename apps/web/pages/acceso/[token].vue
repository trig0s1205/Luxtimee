<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: ['staff-login-token', 'guest'] });

useHead({
  htmlAttrs: { lang: 'es' },
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const route = useRoute();
const redirect = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : null,
);

useSeoMeta({
  title: 'Iniciar sesión — LUXTIMEE',
});
</script>

<template>
  <div class="auth-page">
    <p class="auth-mark">LUXTIMEE</p>
    <AuthLoginPanel :redirect="redirect" />
  </div>
</template>
