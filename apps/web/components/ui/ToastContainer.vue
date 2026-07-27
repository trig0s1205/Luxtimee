<script setup lang="ts">
const { toasts, remove } = useToast();

const toneClasses = {
  success: 'admin-toast--success',
  error: 'admin-toast--error',
  info: 'admin-toast--info',
  warning: 'admin-toast--warning',
};
</script>

<template>
  <Teleport to="body">
    <div class="admin-toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="admin-toast"
          :class="toneClasses[toast.tone]"
          @click="remove(toast.id)"
        >
          <span class="admin-toast-message">{{ toast.message }}</span>
          <button type="button" class="admin-toast-close" aria-label="Cerrar">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.admin-toast-stack {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.admin-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 280px;
  max-width: 420px;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(17, 17, 17, 0.98);
  font-family: var(--lux-font-body);
  font-size: 12px;
  color: var(--lux-white);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.admin-toast--success {
  border-left: 3px solid #4cdf8b;
}

.admin-toast--error {
  border-left: 3px solid #ff5555;
}

.admin-toast--info {
  border-left: 3px solid var(--lux-gold);
}

.admin-toast--warning {
  border-left: 3px solid #f0b429;
}

.admin-toast-close {
  background: transparent;
  border: none;
  color: var(--lux-white-dim);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
