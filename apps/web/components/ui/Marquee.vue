<script setup lang="ts">
defineProps<{ items: string[] }>();
</script>

<template>
  <div class="overflow-hidden border-y border-lux-gold/15 bg-lux-black-2 py-4">
    <div class="lux-marquee flex gap-16 whitespace-nowrap text-[11px] uppercase tracking-[0.3em] text-lux-white-dim">
      <span v-for="(item, idx) in [...items, ...items]" :key="idx" class="flex items-center gap-4">
        {{ item }}
        <span class="w-1 h-1 rounded-full bg-lux-gold" />
      </span>
    </div>
  </div>
</template>
