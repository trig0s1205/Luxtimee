<script setup lang="ts">
defineProps<{ frontUrl?: string | null; backUrl?: string | null; alt: string }>();

const active = ref<'front' | 'back'>('front');
</script>

<template>
  <div class="space-y-4">
    <div class="aspect-square bg-lux-black-2 flex items-center justify-center overflow-hidden border border-lux-gold/10">
      <img
        :src="(active === 'back' && backUrl ? backUrl : frontUrl) || undefined"
        :alt="alt"
        class="max-w-[85%] max-h-[85%] object-contain"
      />
    </div>
    <div v-if="backUrl" class="flex gap-2">
      <button
        type="button"
        class="flex-1 py-2 text-[10px] uppercase tracking-widest border transition-colors"
        :class="active === 'front' ? 'border-lux-gold text-lux-gold' : 'border-lux-gold/20 text-lux-white-dim'"
        @click="active = 'front'"
      >
        Frontal
      </button>
      <button
        type="button"
        class="flex-1 py-2 text-[10px] uppercase tracking-widest border transition-colors"
        :class="active === 'back' ? 'border-lux-gold text-lux-gold' : 'border-lux-gold/20 text-lux-white-dim'"
        @click="active = 'back'"
      >
        Trasera
      </button>
    </div>
  </div>
</template>
