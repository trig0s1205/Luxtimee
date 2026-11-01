<template>
  <div class="auth-shell">
    <slot />
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: var(--black);
  box-sizing: border-box;
}

.auth-shell :deep(.auth-page) {
  min-height: 0;
  width: min(460px, 100%);
  padding: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.auth-shell :deep(.auth-mark) {
  margin: 0 0 28px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  color: var(--white);
}

.auth-shell :deep(.auth-card) {
  max-width: none;
}

@media (max-width: 480px) {
  .auth-shell {
    padding: 24px 16px;
    align-items: center;
  }

  .auth-shell :deep(.auth-card) {
    padding: 32px 20px;
  }

  .auth-shell :deep(.auth-mark) {
    margin-bottom: 20px;
    font-size: 16px;
  }
}
</style>
