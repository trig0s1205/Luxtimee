<script setup lang="ts">
defineProps<{
  label?: string;
  title?: string;
  refreshable?: boolean;
  refreshing?: boolean;
}>();

defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <div class="lux-section-header mb-8">
    <div class="lux-section-header__row">
      <div class="lux-section-header__text">
        <p v-if="label" class="lux-section-label">{{ label }}</p>
        <h2 v-if="title" class="lux-section-title">{{ title }}</h2>
      </div>
      <div v-if="refreshable" class="lux-section-header__actions">
        <UiAdminRefreshButton :loading="refreshing" @click="$emit('refresh')" />
      </div>
    </div>
    <slot />
  </div>
</template>
