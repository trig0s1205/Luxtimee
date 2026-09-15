<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin'],
  pageTransition: false,
  layoutTransition: false,
});
</script>

<template>
  <NuxtPage keepalive :keepalive-props="{ max: 15 }" />
</template>
