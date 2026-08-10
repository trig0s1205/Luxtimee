<script setup lang="ts">
const emit = defineEmits<{ logout: [] }>();
</script>

<template>
  <aside class="admin-sidebar flex flex-col w-64 p-6 shrink-0 admin-shell">
    <div class="admin-sidebar-brand">
      <h2>LUXTIMEE</h2>
      <p>Administración de relojería de lujo</p>
    </div>

    <AdminNavLinks />

    <div class="admin-sidebar-footer">
      <NuxtLink
        to="/admin/configuracion"
        prefetch
        class="admin-nav-link"
        :class="{ active: $route.path.startsWith('/admin/configuracion') }"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        Configuración
      </NuxtLink>

      <button type="button" class="admin-nav-link admin-logout-btn--sidebar !border-0 !bg-transparent" @click="emit('logout')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Cerrar sesión
      </button>
    </div>
  </aside>
</template>
