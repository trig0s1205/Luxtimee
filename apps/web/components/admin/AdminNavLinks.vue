<script setup lang="ts">
const props = defineProps<{
  mobile?: boolean;
}>();

const emit = defineEmits<{ navigate: [] }>();

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
  { to: '/admin/pre-pedidos/nuevo', label: 'Nuevo manual' },
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

function onNavigate() {
  emit('navigate');
}
</script>

<template>
  <nav class="admin-sidebar-nav" :class="{ 'admin-sidebar-nav--mobile': mobile }">
    <div class="admin-nav-section">
      <p class="admin-nav-section-label">Panel</p>
      <NuxtLink
        v-for="link in visibleDashboardLinks"
        :key="link.to"
        :to="link.to"
        prefetch
        class="admin-nav-link"
        :class="{ active: isActive(link.to) }"
        @click="onNavigate"
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
        prefetch
        class="admin-nav-link"
        :class="{ active: isActive(link.to) }"
        @click="onNavigate"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="1" />
        </svg>
        {{ link.label }}
      </NuxtLink>

      <div class="admin-nav-dropdown" :class="{ 'admin-nav-dropdown--expanded': mobile }">
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
            prefetch
            class="admin-nav-link admin-nav-link--sub"
            :class="{ active: isActive(link.to) }"
            @click="onNavigate"
          >
            {{ link.label }}
          </NuxtLink>
        </div>
      </div>

      <div class="admin-nav-dropdown" :class="{ 'admin-nav-dropdown--expanded': mobile }">
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
            prefetch
            class="admin-nav-link admin-nav-link--sub"
            :class="{ active: isActive(link.to) }"
            @click="onNavigate"
          >
            {{ link.label }}
          </NuxtLink>
        </div>
      </div>

      <NuxtLink
        v-for="link in visibleLinks(linksAfterPedidos)"
        :key="`${link.to}-${link.label}`"
        :to="link.to"
        prefetch
        class="admin-nav-link"
        :class="{ active: isActive(link.to) }"
        @click="onNavigate"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="1" />
        </svg>
        {{ link.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
