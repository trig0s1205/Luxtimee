<script setup lang="ts">
const { visible, hide } = useStockNotice();
const { t } = useLocale();
</script>

<template>
  <Teleport to="body">
    <Transition name="stock-notice">
      <div v-if="visible" class="stock-notice" role="alert">
        <p class="stock-notice-text">{{ t('cart.stockLimit') }}</p>
        <button type="button" class="stock-notice-close" aria-label="Cerrar" @click="hide">×</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.stock-notice {
  position: fixed;
  bottom: 32px;
  left: 50%;
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 16px;
  width: min(calc(100% - 32px), 480px);
  padding: 14px 18px;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: rgba(17, 17, 17, 0.98);
  transform: translateX(-50%);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.stock-notice-text {
  margin: 0;
  flex: 1;
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--white-dim, #ccc);
  font-style: italic;
}

.stock-notice-close {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--gold, #c8a96e);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.stock-notice-enter-active,
.stock-notice-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.stock-notice-enter-from,
.stock-notice-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
