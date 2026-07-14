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
        ? 'bg-lux-gold text-lux-black hover:bg-lux-gold-light hover:-translate-y-0.5 hover:shadow-lux'
        : 'border border-lux-white/25 text-lux-white hover:border-lux-gold hover:text-lux-gold hover:-translate-y-0.5'
    "
  >
    <slot />
  </button>
</template>
