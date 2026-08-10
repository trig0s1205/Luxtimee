<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin'] });
</script>

<template>
  <NuxtPage keepalive :keepalive-props="{ max: 15 }" />
</template>
