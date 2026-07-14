<script setup lang="ts">
defineProps<{ label?: string; title?: string }>();
</script>

<template>
  <div class="mb-8">
    <p v-if="label" class="lux-section-label">{{ label }}</p>
    <h2 v-if="title" class="lux-section-title">{{ title }}</h2>
    <slot />
  </div>
</template>
