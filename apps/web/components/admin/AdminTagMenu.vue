<script setup lang="ts">
const props = defineProps<{
  label?: string;
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onUnmounted(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div ref="root" class="admin-tag-menu" :class="{ 'admin-tag-menu--open': open }">
    <button type="button" class="admin-tag-menu-trigger" @click.stop="open = !open">
      {{ label ?? 'Etiquetas' }}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div v-if="open" class="admin-tag-menu-panel" @click.stop>
      <div class="admin-tag-list">
        <slot />
      </div>
    </div>
  </div>
</template>
