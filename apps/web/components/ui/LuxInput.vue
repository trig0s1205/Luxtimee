<script setup lang="ts">
defineProps<{ modelValue?: string; placeholder?: string; type?: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <input
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    class="w-full bg-transparent border border-lux-gold/25 px-4 py-3 text-sm text-lux-white placeholder:text-lux-white-dim focus:border-lux-gold outline-none"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
