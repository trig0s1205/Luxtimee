<script setup lang="ts">
import type { WholesaleExtraDef } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = defineProps<{
  extras: WholesaleExtraDef[];
  selected: Array<{ extraId: string; quantity: number }>;
}>();

const emit = defineEmits<{
  change: [extra: { extraId: string; name: string; quantity: number }];
}>();

function quantityOf(extraId: string) {
  return props.selected.find((row) => row.extraId === extraId)?.quantity ?? 0;
}

function setQuantity(extra: WholesaleExtraDef, quantity: number) {
  emit('change', {
    extraId: extra.id,
    name: extra.name,
    quantity: Math.max(0, Math.min(99, quantity)),
  });
}
</script>

<template>
  <div v-if="extras.length" class="space-y-2">
    <p class="text-xs uppercase tracking-widest text-lux-white-dim">Extras por reloj</p>
    <p class="text-xs text-lux-white-dim">El reloj ya incluye lo normal. Pedir más suma. Quitar lo incluido no baja el precio.</p>
    <div v-for="extra in extras" :key="extra.id" class="flex items-center justify-between gap-3 text-sm">
      <span>{{ extra.name }} <span class="text-lux-gold">+{{ formatCop(extra.price) }}</span></span>
      <span class="flex items-center gap-2">
        <button type="button" class="w-8 h-8 border border-lux-gold/30" @click="setQuantity(extra, quantityOf(extra.id) - 1)">−</button>
        <span class="w-6 text-center">{{ quantityOf(extra.id) }}</span>
        <button type="button" class="w-8 h-8 border border-lux-gold/30" @click="setQuantity(extra, quantityOf(extra.id) + 1)">+</button>
      </span>
    </div>
  </div>
</template>
