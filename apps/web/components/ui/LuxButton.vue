<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center px-10 py-4 text-[11px] font-semibold uppercase tracking-lux transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="
      variant === 'primary'
        ? 'bg-lux-white text-lux-black hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(255,255,255,0.12)]'
        : 'border border-lux-white/25 text-lux-white hover:border-lux-white hover:text-lux-white hover:-translate-y-0.5'
    "
  >
    <slot />
  </button>
</template>
