<script setup lang="ts">
const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="isDark ? 'Modo claro' : 'Modo oscuro'"
    :title="isDark ? 'Modo claro' : 'Modo oscuro'"
    @click="toggleTheme"
  >
    <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3 6 6 0 1 0 21 14.5z" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  border-radius: 50%;
  background: transparent;
  color: var(--white);
  cursor: pointer;
  transition: border-color 0.25s, color 0.25s, background 0.25s;
}

.theme-toggle:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.theme-toggle svg {
  width: 18px;
  height: 18px;
}
</style>
