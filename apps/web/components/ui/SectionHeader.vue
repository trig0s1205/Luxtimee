<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string;
  title?: string;
  heading?: 'h1' | 'h2';
  refreshable?: boolean;
  refreshing?: boolean;
}>(), {
  heading: 'h2',
});

defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <div class="lux-section-header mb-8">
    <div class="lux-section-header__row">
      <div class="lux-section-header__text">
        <p v-if="label" class="lux-section-label">{{ label }}</p>
        <component :is="props.heading" v-if="title" class="lux-section-title">{{ title }}</component>
      </div>
      <div v-if="refreshable" class="lux-section-header__actions">
        <UiAdminRefreshButton :loading="refreshing" @click="$emit('refresh')" />
      </div>
    </div>
    <slot />
  </div>
</template>
