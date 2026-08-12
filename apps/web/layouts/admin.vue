<script setup lang="ts">
import type { BrandDto, CategoryDto, ShippingZoneDto } from '@luxtime/shared';
import { preloadRouteComponents } from '#app';
import { warmupAdminModules } from '~/utils/admin-warmup';

const auth = useAuthStore();

// Doble verificación: si no hay usuario staff, no renderizar nada
if (!auth.user || (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN')) {
  throw createError({ statusCode: 403, statusMessage: 'Acceso denegado' });
}

const api = useApi();

const ADMIN_ROUTES = [
  '/admin/inventario',
  '/admin/catalog-settings',
  '/admin/pre-pedidos/activos',
  '/admin/pre-pedidos/suspendidos',
  '/admin/pre-pedidos/nuevo',
  '/admin/pedidos/detal',
  '/admin/pedidos/mayor',
  '/admin/garantias',
  '/admin/envios',
  '/admin/socios-mayoristas',
  '/admin/configuracion',
  '/admin/dashboards/salud',
  '/admin/dashboards/analytics',
  '/admin/dashboards/ganancia',
  '/admin/notificaciones',
];

useHead({
  htmlAttrs: { lang: 'es' },
});

onMounted(() => {
  if (!import.meta.client) return;

  for (const route of ADMIN_ROUTES) {
    void preloadRouteComponents(route);
  }

  const catalog = useAdminCatalogStore();
  const adminData = useAdminDataStore();

  void catalog.ensureAll({
    brands: () => api.get<BrandDto[]>('/brands').catch(() => []),
    categories: () => api.get<CategoryDto[]>('/categories').catch(() => []),
  });
  void adminData.ensureZones(() => api.get<ShippingZoneDto[]>('/shipping-zones').catch(() => []));

  warmupAdminModules(api);
});

const { open: sidebarOpen, close: closeSidebar } = useAdminSidebar();

watch(sidebarOpen, (isOpen) => {
  if (!import.meta.client) return;
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = '';
});

async function logout() {
  const auth = useAuthStore();
  await auth.logout();
  await navigateTo('/');
}
</script>



<template>
  <NuxtLoadingIndicator color="var(--lux-gold, #C8A96E)" :height="2" />

  <div class="admin-layout admin-shell">
    <div
      class="admin-sidebar-backdrop"
      :class="{ 'is-open': sidebarOpen }"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <AdminSidebar @logout="logout" />

    <div class="admin-content-column">
      <AdminTopBar />
      <main class="admin-main">
        <slot />
      </main>
    </div>

    <UiConfirmDialog />
  </div>
</template>

<style>
@import '~/assets/css/admin-dashboard.css';
@import '~/assets/css/admin-tables.css';
@import '~/assets/css/admin-records.css';
</style>

