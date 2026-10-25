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
  '/admin/ventas',
  '/admin/garantias',
  '/admin/envios',
  '/admin/socios-mayoristas',
  '/admin/mayorista-ofertas',
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

  auth.hydrateTokens();

  for (const route of ADMIN_ROUTES) {
    void preloadRouteComponents(route);
  }

  const catalog = useAdminCatalogStore();
  const adminData = useAdminDataStore();

  async function loadSharedAdminData() {
    if (!auth.hasApiSession) return;
    catalog.invalidate();
    await catalog.ensureAll({
      brands: () => api.get<BrandDto[]>('/brands'),
      categories: () => api.get<CategoryDto[]>('/categories'),
    });
    await adminData.ensureZones(() => api.get<ShippingZoneDto[]>('/shipping-zones'));
    warmupAdminModules(api);
  }

  void loadSharedAdminData().catch(() => null);

  watch(
    () => (auth.hasApiSession ? auth.sessionCheckedAt : 0),
    (ts, prev) => {
      if (ts && ts !== prev) void loadSharedAdminData().catch(() => null);
    },
  );
});

const bulkDraft = useWatchBulkDraftStore();
const bulkNotice = computed(() => {
  if (!auth.isSuperAdmin) return '';
  const pending = bulkDraft.pendingCount;
  if (pending > 0) {
    return pending === 1
      ? 'Carga por fotos en curso: queda 1 par. Puedes cambiar de sección.'
      : `Carga por fotos en curso: quedan ${pending} pares. Puedes cambiar de sección.`;
  }
  const settlement = bulkDraft.settlement;
  if (!settlement || settlement.seq === bulkDraft.ackedSettlement) return '';
  const { done, failed } = settlement;
  if (done && failed) return `Carga por fotos: ${done} borradores listos y ${failed} pares con error.`;
  if (failed === 1) return 'Carga por fotos: 1 par falló. En Inventario puedes reintentarlo.';
  if (failed) return `Carga por fotos: ${failed} pares fallaron. En Inventario puedes reintentarlos.`;
  if (done === 1) return 'Carga por fotos: 1 borrador creado.';
  if (done) return `Carga por fotos: ${done} borradores creados.`;
  return '';
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
  <UiStorefrontRouteProgress />

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
      <p v-if="bulkNotice" class="admin-bulk-live" role="status">{{ bulkNotice }}</p>
      <main class="admin-main">
        <slot />
      </main>
    </div>

    <UiConfirmDialog />
  </div>
</template>

<style>
@import '~/assets/css/admin-theme-light.css';
@import '~/assets/css/admin-dashboard.css';
@import '~/assets/css/admin-tables.css';
@import '~/assets/css/admin-records.css';

.admin-bulk-live {
  margin: 0;
  padding: 8px 16px;
  font-family: var(--lux-font-body);
  font-size: 12px;
  line-height: 1.4;
  color: var(--lux-white);
  background: rgba(200, 169, 110, 0.16);
  border-bottom: 1px solid rgba(200, 169, 110, 0.45);
}
</style>

