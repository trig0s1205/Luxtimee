<script setup lang="ts">
const emit = defineEmits<{ logout: [] }>();

const route = useRoute();
const mobileOpen = ref(false);

function closeMobile() {
  mobileOpen.value = false;
}

watch(() => route.path, () => {
  mobileOpen.value = false;
});

function onLogout() {
  closeMobile();
  emit('logout');
}
</script>

<template>
  <header class="admin-mobile-header lg:hidden">
    <button
      type="button"
      class="admin-mobile-menu-btn"
      aria-label="Abrir menú"
      @click="mobileOpen = true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
    <div class="admin-mobile-header-brand">
      <span class="admin-mobile-header-title">LUXTIMEE</span>
      <span class="admin-mobile-header-sub">Admin</span>
    </div>
  </header>

  <Teleport to="body">
    <div
      v-if="mobileOpen"
      class="admin-mobile-overlay lg:hidden"
      aria-hidden="true"
      @click="closeMobile"
    />

    <aside
      v-if="mobileOpen"
      class="admin-mobile-drawer lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de administración"
    >
      <div class="admin-mobile-drawer-head">
        <div class="admin-sidebar-brand admin-sidebar-brand--compact">
          <h2>LUXTIMEE</h2>
          <p>Administración</p>
        </div>
        <button type="button" class="admin-mobile-close-btn" aria-label="Cerrar menú" @click="closeMobile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <AdminNavLinks mobile @navigate="closeMobile" />

      <div class="admin-sidebar-footer">
        <NuxtLink
          to="/admin/configuracion"
          prefetch
          class="admin-nav-link"
          :class="{ active: route.path.startsWith('/admin/configuracion') }"
          @click="closeMobile"
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
  </Teleport>

  <aside class="admin-sidebar hidden lg:flex flex-col w-64 p-6 shrink-0 admin-shell">
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
        :class="{ active: route.path.startsWith('/admin/configuracion') }"
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
