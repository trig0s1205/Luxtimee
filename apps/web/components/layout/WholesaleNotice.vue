<script setup lang="ts">
const { visible, hide } = useWholesaleNotice();
const { t } = useLocale();
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="wholesale-notice-overlay" @click.self="hide">
      <div class="wholesale-notice-card" role="dialog" aria-modal="true" aria-labelledby="wholesale-notice-title">
        <p id="wholesale-notice-title" class="wholesale-notice-title">{{ t('cart.wholesaleTitle') }}</p>
        <p class="wholesale-notice-text">{{ t('cart.wholesaleMessage') }}</p>
        <button type="button" class="wholesale-notice-btn" @click="hide">{{ t('cart.wholesaleOk') }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wholesale-notice-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
}

.wholesale-notice-card {
  width: min(100%, 380px);
  padding: 24px;
  border: var(--border-hairline);
  background: var(--black-2, #111);
  text-align: center;
}

.wholesale-notice-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--gold);
}

.wholesale-notice-text {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--white-dim);
}

.wholesale-notice-btn {
  padding: 10px 18px;
  border: var(--border-hairline);
  background: transparent;
  color: var(--gold);
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.wholesale-notice-btn:hover {
  border-color: rgba(200, 169, 110, 0.35);
}
</style>
