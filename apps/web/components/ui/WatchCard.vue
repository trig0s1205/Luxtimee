<script setup lang="ts">
import type { MockWatch } from '~/mocks/watches';
import { formatCop } from '~/mocks/watches';

defineProps<{ watch: MockWatch }>();
</script>

<template>
  <article class="group bg-lux-black-3 border border-lux-gold/10 overflow-hidden">
    <div class="aspect-[3/4] bg-lux-black-2 flex items-center justify-center overflow-hidden">
      <img
        :src="watch.image"
        :alt="`${watch.brand} ${watch.model}`"
        class="max-w-[80%] max-h-[80%] object-contain transition-transform duration-500 group-hover:-translate-y-2"
        loading="lazy"
      />
    </div>
    <div class="p-6 border-t border-lux-gold/10">
      <p class="text-[9px] uppercase tracking-[0.3em] text-lux-gold mb-2">{{ watch.brand }}</p>
      <h3 class="font-display text-2xl text-lux-white mb-1">{{ watch.model }}</h3>
      <p class="text-[10px] text-lux-white-dim tracking-widest mb-4">{{ watch.movementType }}</p>
      <div class="flex items-center justify-between">
        <p class="font-display text-2xl text-lux-gold">{{ formatCop(watch.retailPrice) }}</p>
        <button
          type="button"
          class="w-10 h-10 border border-lux-gold/30 text-lux-gold hover:bg-lux-gold hover:text-lux-black transition-colors"
          aria-label="Añadir al carrito"
        >
          +
        </button>
      </div>
    </div>
  </article>
</template>
