<script setup lang="ts">
defineProps<{ modelValue?: boolean; label?: string }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <label class="flex items-start gap-3 text-sm text-lux-white-dim cursor-pointer">
    <input
      type="checkbox"
      class="mt-1 accent-lux-gold"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span>{{ label }}<slot /></span>
  </label>
</template>
