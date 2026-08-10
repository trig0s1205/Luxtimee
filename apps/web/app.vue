<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const verification = String(config.public.googleSiteVerification ?? '').trim();

if (verification) {
  useHead({
    meta: [{ name: 'google-site-verification', content: verification }],
  });
}
</script>
