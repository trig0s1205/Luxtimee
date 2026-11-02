<script setup lang="ts">
const props = defineProps<{ src?: string | null }>();
const emit = defineEmits<{ close: [] }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

watch(() => props.src, (src) => {
  if (!import.meta.client) return;
  if (src) window.addEventListener('keydown', onKey);
  else window.removeEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="src"
      class="admin-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de la imagen"
      @click.self="emit('close')"
    >
      <button type="button" class="admin-image-lightbox__close" aria-label="Cerrar" @click="emit('close')">
        ×
      </button>
      <img :src="src" alt="Vista previa" class="admin-image-lightbox__img">
    </div>
  </Teleport>
</template>

<style scoped>
.admin-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.88);
}

.admin-image-lightbox__img {
  max-width: min(92vw, 720px);
  max-height: 86vh;
  object-fit: contain;
}

.admin-image-lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  background: transparent;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
</style>
