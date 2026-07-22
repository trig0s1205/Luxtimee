<script setup lang="ts">
definePageMeta({ middleware: ['guest'] });

useHead({ htmlAttrs: { lang: 'es' } });

const route = useRoute();
const redirect = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : null,
);

useSeoMeta({
  title: 'Iniciar sesión — Luxtime',
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div class="auth-page">
    <AuthLoginPanel :redirect="redirect" />
  </div>
</template>
