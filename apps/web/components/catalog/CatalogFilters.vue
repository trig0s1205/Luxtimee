<script setup lang="ts">
import type { BrandDto } from '@luxtime/shared';

const props = defineProps<{
  brands: BrandDto[];
  modelValue: { brand?: string; movement?: string; available?: string };
}>();

const emit = defineEmits<{ 'update:modelValue': [value: typeof props.modelValue] }>();

const movements = ['Automático', 'Manual', 'Cuarzo'];

function update(key: keyof typeof props.modelValue, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value || undefined });
}
</script>

<template>
  <div class="flex flex-wrap gap-3 mb-8">
    <select
      :value="modelValue.brand ?? ''"
      class="bg-lux-black-2 border border-lux-gold/20 px-4 py-2 text-xs uppercase tracking-widest text-lux-white-dim"
      @change="update('brand', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Todas las marcas</option>
      <option v-for="brand in brands" :key="brand.id" :value="brand.slug">{{ brand.name }}</option>
    </select>
    <select
      :value="modelValue.movement ?? ''"
      class="bg-lux-black-2 border border-lux-gold/20 px-4 py-2 text-xs uppercase tracking-widest text-lux-white-dim"
      @change="update('movement', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Movimiento</option>
      <option v-for="m in movements" :key="m" :value="m">{{ m }}</option>
    </select>
    <select
      :value="modelValue.available ?? ''"
      class="bg-lux-black-2 border border-lux-gold/20 px-4 py-2 text-xs uppercase tracking-widest text-lux-white-dim"
      @change="update('available', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Disponibilidad</option>
      <option value="true">En stock</option>
      <option value="false">Agotado</option>
    </select>
  </div>
</template>
