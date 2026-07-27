<script setup lang="ts">
defineProps<{ modelValue?: boolean; label?: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <label class="flex items-start gap-3 text-sm text-lux-white-dim cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <input
      type="checkbox"
      class="mt-1 accent-lux-gold"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span>{{ label }}<slot /></span>
  </label>
</template>
