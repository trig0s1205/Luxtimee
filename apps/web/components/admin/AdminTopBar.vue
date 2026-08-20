<script setup lang="ts">
const { toggle } = useAdminSidebar();
</script>

<template>
  <header class="admin-topbar">
    <button type="button" class="admin-topbar-menu" aria-label="Abrir menú de navegación" @click="toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
    <div class="admin-topbar-brand">
      <span class="admin-topbar-title">LUXTIMEE</span>
      <span class="admin-topbar-sub">Panel admin</span>
    </div>
    <div class="admin-topbar-actions">
      <LayoutThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.admin-topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
