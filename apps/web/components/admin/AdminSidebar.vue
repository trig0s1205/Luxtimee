<script setup lang="ts">
const emit = defineEmits<{ logout: [] }>();

const route = useRoute();
const { open, close } = useAdminSidebar();

watch(() => route.path, () => close());

function onLogout() {
  close();
  emit('logout');
}
</script>

<template>
  <aside class="admin-sidebar flex flex-col shrink-0" :class="{ 'is-open': open }">
    <div class="admin-sidebar-head">
      <div class="admin-sidebar-brand">
        <h2>LUXTIMEE</h2>
        <p>Administración de relojería de lujo</p>
      </div>
      <button type="button" class="admin-sidebar-close" aria-label="Cerrar menú" @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <AdminNavLinks @navigate="close" />

    <div class="admin-sidebar-footer">
      <div class="admin-sidebar-theme">
        <span class="admin-sidebar-theme-label">Tema</span>
        <LayoutThemeToggle />
      </div>

      <NuxtLink
        to="/admin/configuracion"
        prefetch
        class="admin-nav-link"
        :class="{ active: $route.path.startsWith('/admin/configuracion') }"
        @click="close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        Configuración
      </NuxtLink>

      <button type="button" class="admin-nav-link admin-logout-btn--sidebar !border-0 !bg-transparent" @click="onLogout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Cerrar sesión
      </button>
    </div>
  </aside>
</template>
