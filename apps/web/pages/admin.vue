<script setup lang="ts">
definePageMeta({ layout: 'admin' });
</script>

<template>
  <NuxtPage keepalive :keepalive-props="{ max: 15 }" />
</template>
