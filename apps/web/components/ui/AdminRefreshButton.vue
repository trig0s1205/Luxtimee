<script setup lang="ts">
defineProps<{
  loading?: boolean;
  label?: string;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="admin-refresh-btn"
    :disabled="loading"
    aria-label="Actualizar datos"
    @click="$emit('click')"
  >
    <svg
      class="admin-refresh-btn__icon"
      :class="{ 'admin-refresh-btn__icon--spin': loading }"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
    <span>{{ loading ? 'Actualizando…' : (label ?? 'Actualizar') }}</span>
  </button>
</template>
