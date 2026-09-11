<script setup lang="ts">
import type {
  BrandDto,
  CareTemplateDto,
  CategoryDto,
  MechanismDto,
  PaginatedResponse,
  PendingWatchItemDto,
  WatchStaffDto,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';
import type { AdminWatchFormPayload } from '~/composables/useAdminWatchEditSubmit';

const AdminWatchFormLazy = defineAsyncComponent(() => import('~/components/admin/AdminWatchForm.vue'));

definePageMeta({ middleware: ['admin'], keepalive: true });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();
const catalogStore = useAdminCatalogStore();
const { saveWatchEdit } = useAdminWatchEditSubmit();

const PAGE_SIZE = 10;
const activeTab = ref<'general' | 'cost'>('general');
const page = ref(1);
const costDrafts = reactive<Record<string, string>>({});
const savingCostId = ref<string | null>(null);

const showForm = ref(false);
const editingWatch = ref<WatchStaffDto | null>(null);
const savingForm = ref(false);
const submitError = ref('');

const staffReady = computed(() => auth.loaded && auth.isStaff && !auth.isLocalSession);

const brands = computed(() => catalogStore.brands ?? []);
const categories = computed(() => catalogStore.categories ?? []);
const mechanisms = computed(() => catalogStore.mechanisms ?? []);

const emptyList: PaginatedResponse<PendingWatchItemDto> = {
  data: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
};

const listKey = computed(() => `pending-info-${activeTab.value}-${page.value}`);

const { data: paginated, refresh, pending } = useAdminCachedData(
  listKey,
  () =>
    api
      .get<PaginatedResponse<PendingWatchItemDto>>('/watches/pending-info', {
        section: activeTab.value,
        page: page.value,
        limit: PAGE_SIZE,
      })
      .catch(() => emptyList),
  { watch: [listKey] },
);

const { data: careTemplates, refresh: refreshCare } = useAdminCachedData('care', () =>
  api.get<CareTemplateDto[]>('/care'),
);

async function loadCatalogMeta() {
  if (!staffReady.value) return;
  await catalogStore.ensureAll({
    brands: () => api.get<BrandDto[]>('/brands'),
    categories: () => api.get<CategoryDto[]>('/categories'),
    mechanisms: () => api.get<MechanismDto[]>('/mechanisms'),
  });
}

watch(staffReady, (ready) => {
  if (ready) {
    void loadCatalogMeta();
    void refreshCare();
  }
}, { immediate: true });

useAdminRefetchWhenAuthed([refresh, loadCatalogMeta, refreshCare]);

const items = computed(() => paginated.value?.data ?? []);
const total = computed(() => paginated.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function switchTab(tab: 'general' | 'cost') {
  if (tab === 'cost' && !auth.isSuperAdmin) return;
  activeTab.value = tab;
  page.value = 1;
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
}

function thumbUrl(item: PendingWatchItemDto) {
  const w = item.watch;
  return w.primaryImageUrl || w.frontImageUrl || w.images?.[0] || '';
}

async function openEdit(item: PendingWatchItemDto) {
  submitError.value = '';
  try {
    editingWatch.value = await api.get<WatchStaffDto>(`/watches/${item.watch.id}`);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el reloj'));
    return;
  }
  showForm.value = true;
}

async function handleSubmit(form: AdminWatchFormPayload) {
  if (!editingWatch.value || savingForm.value) return;
  savingForm.value = true;
  submitError.value = '';
  const result = await saveWatchEdit(editingWatch.value, form, brands.value);
  savingForm.value = false;
  if (!result.ok) return;
  showForm.value = false;
  editingWatch.value = null;
  await refresh();
}

async function saveCost(item: PendingWatchItemDto) {
  const raw = costDrafts[item.watch.id];
  const cost = Number(raw);
  if (!Number.isFinite(cost) || cost <= 0) {
    toast.warning('Ingresa un costo mayor a 0 en COP.');
    return;
  }

  savingCostId.value = item.watch.id;
  try {
    await api.patch(`/watches/${item.watch.id}`, { cost });
    toast.success('Costo asignado correctamente.');
    delete costDrafts[item.watch.id];
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'Error al guardar el costo.'));
  } finally {
    savingCostId.value = null;
  }
}

useSeoMeta({ title: 'Pendientes de info — LUXTIMEE Admin' });
</script>

<template>
  <div class="pending-info">
    <UiToastContainer />
    <UiSectionHeader
      label="Operaciones"
      :title="`Pendientes de info (${total})`"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />

    <p class="pending-info-intro">
      Relojes fuera de borrador con datos incompletos. Los borradores solo con imágenes se completan desde inventario.
    </p>

    <div class="pending-info-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="pending-info-tab"
        :class="{ 'is-active': activeTab === 'general' }"
        :aria-selected="activeTab === 'general'"
        @click="switchTab('general')"
      >
        Información general
      </button>
      <button
        v-if="auth.isSuperAdmin"
        type="button"
        role="tab"
        class="pending-info-tab"
        :class="{ 'is-active': activeTab === 'cost' }"
        :aria-selected="activeTab === 'cost'"
        @click="switchTab('cost')"
      >
        Información de costo
      </button>
    </div>

    <div v-if="pending && !items.length" class="pending-info-empty">Cargando...</div>
    <div v-else-if="!items.length" class="pending-info-empty">
      No hay relojes pendientes en esta sección.
    </div>

    <template v-else>
      <table v-if="activeTab === 'general'" class="pending-info-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Reloj</th>
            <th>Falta</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.watch.id">
            <td>
              <img
                v-if="thumbUrl(item)"
                :src="thumbUrl(item)"
                :alt="item.watch.model"
                class="pending-info-thumb"
              >
              <span v-else class="pending-info-no-thumb">—</span>
            </td>
            <td>
              <strong>{{ item.watch.brand.name }} {{ item.watch.model }}</strong>
              <span class="pending-info-sku">{{ item.watch.sku }}</span>
            </td>
            <td>
              <ul class="pending-info-missing">
                <li v-for="field in item.missing" :key="field.code">{{ field.label }}</li>
              </ul>
            </td>
            <td>
              <UiLuxButton @click="openEdit(item)">Completar</UiLuxButton>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-else class="pending-info-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Reloj</th>
            <th>Precio público</th>
            <th>Pendiente</th>
            <th>Costo (COP)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.watch.id">
            <td>
              <img
                v-if="thumbUrl(item)"
                :src="thumbUrl(item)"
                :alt="item.watch.model"
                class="pending-info-thumb"
              >
            </td>
            <td>
              <strong>{{ item.watch.brand.name }} {{ item.watch.model }}</strong>
              <span class="pending-info-sku">{{ item.watch.sku }}</span>
            </td>
            <td>{{ formatCop(item.watch.retailPrice) }}</td>
            <td>
              <ul class="pending-info-missing">
                <li v-for="field in item.missing" :key="field.code">{{ field.label }}</li>
              </ul>
            </td>
            <td>
              <UiLuxInput
                v-model="costDrafts[item.watch.id]"
                type="number"
                placeholder="0"
                min="0"
              />
            </td>
            <td>
              <UiLuxButton
                :disabled="savingCostId === item.watch.id"
                @click="saveCost(item)"
              >
                {{ savingCostId === item.watch.id ? 'Guardando...' : 'Guardar' }}
              </UiLuxButton>
            </td>
          </tr>
        </tbody>
      </table>

      <nav v-if="totalPages > 1" class="pending-info-pagination" aria-label="Paginación">
        <button type="button" class="pending-info-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">
          Anterior
        </button>
        <span class="pending-info-page-info">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" class="pending-info-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">
          Siguiente
        </button>
      </nav>
    </template>

    <Teleport to="body">
      <div v-if="showForm" class="admin-modal-backdrop" @click.self="showForm = false">
        <div class="admin-modal admin-modal--wide">
          <AdminWatchFormLazy
            :watch="editingWatch"
            :brands="brands"
            :categories="categories"
            :mechanisms="mechanisms"
            :care-templates="careTemplates ?? []"
            :saving="savingForm"
            :submit-error="submitError"
            @submit="handleSubmit"
            @cancel="showForm = false"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pending-info {
  max-width: 1200px;
}

.pending-info-intro {
  margin: 0 0 20px;
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white-dim);
}

.pending-info-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.pending-info-tab {
  padding: 10px 16px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  cursor: pointer;
}

.pending-info-tab.is-active {
  border-color: var(--lux-gold, #c8a96e);
  color: var(--lux-white);
}

.pending-info-empty {
  padding: 32px;
  text-align: center;
  color: var(--lux-white-dim);
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.pending-info-table {
  width: 100%;
  border-collapse: collapse;
}

.pending-info-table th,
.pending-info-table td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.12);
  text-align: left;
  vertical-align: middle;
}

.pending-info-table th {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.pending-info-thumb {
  width: 56px;
  height: 84px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.03);
}

.pending-info-no-thumb {
  color: var(--lux-white-dim);
  font-size: 12px;
}

.pending-info-sku {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--lux-white-dim);
}

.pending-info-missing {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--lux-white-dim);
}

.pending-info-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pending-info-page-btn {
  padding: 10px 18px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white);
  cursor: pointer;
}

.pending-info-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pending-info-page-info {
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
