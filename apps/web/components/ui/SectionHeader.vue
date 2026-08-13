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
      <button
        v-if="refreshable"
        type="button"
        class="lux-section-refresh"
        :disabled="refreshing"
        aria-label="Actualizar datos"
        @click="$emit('refresh')"
      >
        <svg
          class="lux-section-refresh__icon"
          :class="{ 'lux-section-refresh__icon--spin': refreshing }"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        <span>{{ refreshing ? 'Actualizando…' : 'Actualizar' }}</span>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.lux-section-header__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.lux-section-header__text {
  min-width: 0;
}

.lux-section-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: transparent;
  color: var(--lux-gold, #c8a96e);
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, opacity 0.2s;
}

.lux-section-refresh:hover:not(:disabled) {
  border-color: rgba(200, 169, 110, 0.65);
  color: var(--lux-white, #fff);
}

.lux-section-refresh:disabled {
  opacity: 0.55;
  cursor: wait;
}

.lux-section-refresh__icon--spin {
  animation: lux-section-spin 0.85s linear infinite;
}

@keyframes lux-section-spin {
  to { transform: rotate(360deg); }
}
</style>
