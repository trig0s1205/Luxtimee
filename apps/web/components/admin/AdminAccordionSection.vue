<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
}>(), {
  defaultOpen: false,
});

const open = ref(props.defaultOpen);
</script>

<template>
  <div class="admin-accordion" :class="{ 'admin-accordion--open': open }">
    <button type="button" class="admin-accordion-trigger" :aria-expanded="open" @click="open = !open">
      <span class="admin-accordion-title">{{ title }}</span>
      <span v-if="subtitle && !open" class="admin-accordion-subtitle">{{ subtitle }}</span>
      <svg class="admin-accordion-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div v-show="open" class="admin-accordion-body">
      <slot />
    </div>
  </div>
</template>
