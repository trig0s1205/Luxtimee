<script setup lang="ts">
defineProps<{
  tone?: 'gold' | 'limited' | 'mayorista' | 'detal';
}>();
</script>

<template>
  <span
    class="inline-block px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-semibold"
    :class="{
      'bg-lux-gold text-lux-black': tone === 'gold' || tone === 'limited',
      'border border-lux-gold text-lux-gold': tone === 'mayorista',
      'border border-lux-white-dim text-lux-white-dim': tone === 'detal',
    }"
  >
    <slot />
  </span>
</template>
