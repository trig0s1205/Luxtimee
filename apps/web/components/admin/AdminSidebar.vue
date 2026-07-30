<script setup lang="ts">
const emit = defineEmits<{ logout: [] }>();

const route = useRoute();
const auth = useAuthStore();

const dashboardLinks = [
  { to: '/admin/dashboards/ganancia', label: 'Ganancia', superOnly: true },
  { to: '/admin/dashboards/salud', label: 'Panel de salud' },
];

const visibleDashboardLinks = computed(() =>
  dashboardLinks.filter((link) => !link.superOnly || auth.isSuperAdmin),
);

const linksBeforePedidos = [
  { to: '/admin/inventario', label: 'Inventario' },
  { to: '/admin/catalog-settings', label: 'Marcas y clases' },
  { to: '/admin/pending-costs', label: 'Pendientes de costo', superOnly: true },
];

const prePedidosLinks = [
  { to: '/admin/pre-pedidos/activos', label: 'Activos' },
  { to: '/admin/pre-pedidos/suspendidos', label: 'Suspendidos' },
];

const linksAfterPedidos = [
  { to: '/admin/socios-mayoristas', label: 'Socios mayoristas' },
  { to: '/admin/garantias', label: 'Garantías' },
  { to: '/admin/envios', label: 'Envíos', superOnly: true },
];

const pedidosLinks = [
  { to: '/admin/pedidos/detal', label: 'Al detal' },
  { to: '/admin/pedidos/mayor', label: 'Al mayor' },
];

const bottomLinks = [
  { to: '/admin/configuracion', label: 'Configuración' },
];

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const isPedidosActive = computed(() => route.path.startsWith('/admin/pedidos'));
const isPrePedidosActive = computed(() => route.path.startsWith('/admin/pre-pedidos'));

function visibleLinks(links: typeof linksBeforePedidos) {
  return links.filter((item) => !item.superOnly || auth.isSuperAdmin);
}
</script>

<template>
  <aside class="admin-sidebar hidden lg:flex flex-col w-64 p-6 shrink-0 admin-shell">
    <div class="admin-sidebar-brand">
      <h2>LUXTIME</h2>
      <p>Administración de relojería de lujo</p>
    </div>

    <nav class="admin-sidebar-nav">
      <div class="admin-nav-section">
        <p class="admin-nav-section-label">Panel</p>
        <NuxtLink
          v-for="link in visibleDashboardLinks"
          :key="link.to"
          :to="link.to"
          class="admin-nav-link"
          :class="{ active: isActive(link.to) }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M3 12h4l2-7 4 14 2-7h6" />
          </svg>
          {{ link.label }}
        </NuxtLink>
      </div>

      <div class="admin-nav-section">
        <NuxtLink
          v-for="link in visibleLinks(linksBeforePedidos)"
          :key="`${link.to}-${link.label}`"
          :to="link.to"
          class="admin-nav-link"
          :class="{ active: isActive(link.to) }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="1" />
          </svg>
          {{ link.label }}
        </NuxtLink>

        <div class="admin-nav-dropdown">
          <div class="admin-nav-link" :class="{ active: isPrePedidosActive }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="1" />
            </svg>
            Pre-pedidos
          </div>

          <div class="admin-nav-dropdown-menu">
            <NuxtLink
              v-for="link in prePedidosLinks"
              :key="link.to"
              :to="link.to"
              class="admin-nav-link admin-nav-link--sub"
              :class="{ active: isActive(link.to) }"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>

        <div class="admin-nav-dropdown">
          <div class="admin-nav-link" :class="{ active: isPedidosActive }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="1" />
            </svg>
            Pedidos
          </div>

          <div class="admin-nav-dropdown-menu">
            <NuxtLink
              v-for="link in pedidosLinks"
              :key="link.to"
              :to="link.to"
              class="admin-nav-link admin-nav-link--sub"
              :class="{ active: isActive(link.to) }"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>

        <NuxtLink
          v-for="link in visibleLinks(linksAfterPedidos)"
          :key="`${link.to}-${link.label}`"
          :to="link.to"
          class="admin-nav-link"
          :class="{ active: isActive(link.to) }"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="1" />
          </svg>
          {{ link.label }}
        </NuxtLink>
      </div>
    </nav>

    <div class="admin-sidebar-footer">
    <NuxtLink
      v-for="link in bottomLinks"
      :key="link.to"
      :to="link.to"
      class="admin-nav-link"
      :class="{ active: isActive(link.to) }"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {{ link.label }}
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
