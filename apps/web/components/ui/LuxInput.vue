<script setup lang="ts">
defineProps<{ modelValue?: string | number | null; placeholder?: string; type?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.type === 'number') {
    emit('update:modelValue', target.value === '' ? 0 : Number(target.value));
  } else {
    emit('update:modelValue', target.value);
  }
}
</script>

<template>
  <input
    :type="type || 'text'"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    class="lux-input"
    @input="onInput"
  />
</template>

<style scoped>
.lux-input {
  width: 100%;
  background: transparent;
  border: var(--border-hairline);
  padding: 12px 16px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--white);
  outline: none;
  transition: border-color 0.2s;
}

.lux-input::placeholder {
  color: var(--white-dim);
}

.lux-input:focus {
  border-color: rgba(200, 169, 110, 0.22);
}
</style>
