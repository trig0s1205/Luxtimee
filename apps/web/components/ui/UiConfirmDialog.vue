<script setup lang="ts">
const { state, accept, cancel } = useConfirm();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="lux-confirm-overlay"
      @click.self="cancel()"
    >
      <div
        class="lux-confirm-card"
        role="dialog"
        aria-modal="true"
        :aria-label="state.title"
      >
        <p class="lux-confirm-title">{{ state.title }}</p>
        <p v-if="state.message" class="lux-confirm-text">{{ state.message }}</p>
        <div class="lux-confirm-actions">
          <button type="button" class="lux-confirm-cancel" @click="cancel()">
            {{ state.cancelLabel }}
          </button>
          <button
            type="button"
            class="lux-confirm-accept"
            :class="{ 'is-destructive': state.destructive }"
            @click="accept()"
          >
            {{ state.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lux-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
}

.lux-confirm-card {
  width: min(100%, 400px);
  padding: 24px;
  border: var(--border-hairline);
  background: var(--black-2, #111);
  text-align: center;
}

.lux-confirm-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--gold);
}

.lux-confirm-text {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--white-dim);
}

.lux-confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.lux-confirm-cancel,
.lux-confirm-accept {
  padding: 10px 18px;
  border: var(--border-hairline);
  background: transparent;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.lux-confirm-cancel {
  color: var(--white-dim);
}

.lux-confirm-accept {
  color: var(--gold);
}

.lux-confirm-accept.is-destructive {
  color: #f0a8a8;
}

.lux-confirm-accept:hover,
.lux-confirm-cancel:hover {
  border-color: rgba(200, 169, 110, 0.35);
}
</style>
