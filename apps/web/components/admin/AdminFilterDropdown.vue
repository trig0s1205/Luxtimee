<script setup lang="ts">
type Option = { key: string; label: string };

const props = defineProps<{
  modelValue: string;
  label: string;
  options: Option[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const selectedLabel = computed(
  () => props.options.find((option) => option.key === props.modelValue)?.label ?? props.label,
);

function select(key: string) {
  emit('update:modelValue', key);
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onUnmounted(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div ref="root" class="admin-filter-dropdown" :class="{ 'admin-filter-dropdown--open': open }">
    <button type="button" class="admin-filter-dropdown-trigger" @click.stop="open = !open">
      <span class="admin-filter-dropdown-label">{{ label }}</span>
      <span class="admin-filter-dropdown-value">{{ selectedLabel }}</span>
      <svg class="admin-filter-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <ul v-if="open" class="admin-filter-dropdown-menu">
      <li v-for="option in options" :key="option.key">
        <button
          type="button"
          class="admin-filter-dropdown-option"
          :class="{ 'admin-filter-dropdown-option--active': option.key === modelValue }"
          @click="select(option.key)"
        >
          {{ option.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
