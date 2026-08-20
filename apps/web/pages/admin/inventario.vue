<script setup lang="ts">
import type { BrandDto, CareTemplateDto, CategoryDto, MechanismDto, InventoryInsightsDto, PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { WatchStatus } from '@luxtime/shared';
import { extractApiErrorMessage, isBadRequest } from '~/utils/api-error';
import { invalidateAdminCache } from '~/utils/admin-cache';
import { validateWatchVideoFile } from '~/utils/video-validation';

const AdminWatchFormLazy = defineAsyncComponent(() => import('~/components/admin/AdminWatchForm.vue'));

type WatchFormPayload = {
  brandId: string;
  categoryId?: string;
  mechanismId?: string;
  movementType?: string;
  model: string;
  description?: string;
  gender?: string;
  warrantyMonths: number;
  careTemplateId?: string;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  profitPercent?: number;
  retailMarginPercentage?: number;
  wholesaleMarginPercentage?: number;
  stock: number;
  status: WatchStatus;
  isLimitedEdition: boolean;
  limitedEditionNumber?: string;
  images: string[];
  mainImageIndex: number;
  primaryImageUrl?: string;
  secondaryImageUrl?: string;
  videoUrl?: string;
  primaryImageFile?: File | null;
  secondaryImageFile?: File | null;
  videoFile?: File | null;
};

useHead({ title: 'Inventario — LUXTIMEE Admin' });
definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();
const auth = useAuthStore();
const catalogStore = useAdminCatalogStore();

const PAGE_SIZE = 30;
const loadPages = ref(1);

const query = reactive({
  search: '',
  brand: '',
});

const searchInput = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    query.search = searchInput.value;
    loadPages.value = 1;
  }, 300);
}

const fetchQuery = computed(() => ({
  search: query.search || undefined,
  brand: query.brand || undefined,
  page: 1,
  limit: PAGE_SIZE * loadPages.value,
}));

const showForm = ref(false);
const editingWatch = ref<WatchStaffDto | null>(null);
const saving = ref(false);
const submitError = ref('');

const mediaQueue = useMediaUploadStore();

const brands = computed(() => catalogStore.brands);
const categories = computed(() => catalogStore.categories);
const mechanisms = computed(() => catalogStore.mechanisms);

// Brands/categories desde cache Pinia + watches en paralelo sin bloquear UI
const watchesKey = computed(() =>
  `admin-watches-${query.search}-${query.brand}-${loadPages.value}`,
);

const staffReady = computed(() => auth.loaded && auth.isStaff && !auth.isLocalSession);

const { data: paginated, refresh, pending, error: watchesError } = useAdminCachedData(
  watchesKey,
  () => api.get<PaginatedResponse<WatchStaffDto>>('/watches', fetchQuery.value as Record<string, string | number | boolean | undefined>),
  { watch: [watchesKey] },
);

const { data: insights, pending: insightsPending, refresh: refreshInsights, error: insightsError } = useAdminCachedData(
  'inventory-insights',
  () => api.get<InventoryInsightsDto>('/watches/inventory-insights'),
);

const { data: careTemplates, refresh: refreshCare } = useAdminCachedData('care', () =>
  api.get<CareTemplateDto[]>('/care'),
);

async function loadCatalogMeta() {
  if (!staffReady.value) return;
  catalogStore.invalidate();
  await catalogStore.ensureAll({
    brands: () => api.get<BrandDto[]>('/brands'),
    categories: () => api.get<CategoryDto[]>('/categories'),
    mechanisms: () => api.get<MechanismDto[]>('/mechanisms'),
  });
}

watch(staffReady, (ready) => {
  if (ready) {
    void loadCatalogMeta();
    void refresh();
    void refreshInsights();
    void refreshCare();
  }
}, { immediate: true });

useAdminRefetchWhenAuthed([refresh, refreshInsights, refreshCare, loadCatalogMeta]);

watch([watchesError, insightsError], ([wErr, iErr]) => {
  const err = wErr ?? iErr;
  if (err) toast.error(extractApiErrorMessage(err, 'No se pudo cargar el inventario'));
});

const watches = computed(() => paginated.value?.data ?? []);
const total = computed(() => paginated.value?.total ?? 0);
const hasMore = computed(() => watches.value.length < total.value);
const inventoryRefreshing = computed(() => pending.value || insightsPending.value);

async function reloadInventory() {
  await Promise.all([refresh(), refreshInsights()]);
}

watch(() => query.brand, () => {
  loadPages.value = 1;
});

function loadMore() {
  loadPages.value += 1;
}

function openCreate() {
  editingWatch.value = null;
  submitError.value = '';
  showForm.value = true;
}

function openEdit(watch: WatchStaffDto) {
  editingWatch.value = watch;
  submitError.value = '';
  showForm.value = true;
}

async function handleSubmit(form: WatchFormPayload) {
  if (saving.value) return;

  const isCreate = !editingWatch.value;
  const hasNewFiles = !!(form.primaryImageFile && form.secondaryImageFile && form.videoFile);

  if (isCreate && !hasNewFiles) {
    submitError.value = 'Debes subir foto principal, foto secundaria y video.';
    toast.warning(submitError.value);
    return;
  }

  if (form.videoFile) {
    const videoError = await validateWatchVideoFile(form.videoFile);
    if (videoError) {
      submitError.value = videoError;
      toast.warning(videoError);
      return;
    }
  }

  saving.value = true;
  submitError.value = '';

  try {
    let watchId = editingWatch.value?.id;

    const payload: Record<string, unknown> = {
      brandId: form.brandId,
      categoryId: form.categoryId || undefined,
      mechanismId: form.mechanismId || undefined,
      movementType: form.movementType || undefined,
      model: form.model,
      description: form.description,
      gender: form.gender,
      warrantyMonths: Number(form.warrantyMonths),
      retailPrice: Number(form.retailPrice),
      wholesalePrice: Number(form.wholesalePrice),
      stock: Number(form.stock),
      status: form.status,
      isLimitedEdition: form.isLimitedEdition,
      limitedEditionNumber: form.limitedEditionNumber,
      images: form.images,
      mainImageIndex: form.mainImageIndex,
      ...(watchId
        ? { careTemplateId: form.careTemplateId || '' }
        : form.careTemplateId
          ? { careTemplateId: form.careTemplateId }
          : {}),
    };

    if (auth.isSuperAdmin && form.cost !== undefined) {
      payload.cost = Number(form.cost);
    } else if (!auth.isSuperAdmin && editingWatch.value && Number(form.cost) === 0) {
      payload.cost = 0;
    }

    let brandName = brands.value?.find((b) => b.id === form.brandId)?.name ?? '';

    if (watchId) {
      await api.patch<WatchStaffDto>(`/watches/${watchId}`, payload);
      toast.success(hasNewFiles ? 'Reloj actualizado — multimedia en proceso...' : 'Reloj actualizado correctamente');
    } else {
      const created = await api.post<WatchStaffDto>('/watches', payload);
      watchId = created.id;
      brandName = created.brand?.name ?? brandName;
      toast.success('Reloj creado — multimedia en cola...');
    }

    // Cerrar modal INMEDIATAMENTE
    showForm.value = false;
    editingWatch.value = null;

    if (hasNewFiles && watchId) {
      mediaQueue.enqueue({
        watchId,
        model: form.model,
        brandName,
        files: {
          image1: form.primaryImageFile!,
          image2: form.secondaryImageFile!,
          video: form.videoFile!,
        },
      });
    }

    invalidateAdminCache(watchesKey.value);
    invalidateAdminCache('inventory-insights');
    // Refresh en background sin await para no bloquear el cierre
    void refresh();
    void refreshInsights();
  } catch (err: unknown) {
    const message = extractApiErrorMessage(err, 'Error al guardar el reloj');
    submitError.value = message;
    if (isBadRequest(err)) toast.warning(message);
    else toast.error(message);
  } finally {
    saving.value = false;
  }
}

async function handleDelete(watch: WatchStaffDto) {
  const ok = await confirm({
    title: `¿Eliminar permanentemente ${watch.brand.name} ${watch.model}?`,
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    await api.del(`/watches/${watch.id}`);
    toast.success('Reloj eliminado correctamente');
    invalidateAdminCache(watchesKey.value);
    invalidateAdminCache('inventory-insights');
    await refresh();
    await refreshInsights();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'Error al eliminar el reloj'));
  }
}
</script>

<template>
  <div class="admin-inventory">
    <UiToastContainer />

    <div class="admin-inventory-header">
      <UiSectionHeader
        label="Operaciones"
        title="Inventario de relojes"
      />
      <UiLuxButton @click="openCreate">+ Nuevo Reloj</UiLuxButton>
    </div>

    <AdminInventoryInsights :insights="insights" :loading="insightsPending" />

    <div class="admin-inventory-toolbar">
      <UiAdminRefreshButton :loading="inventoryRefreshing" @click="reloadInventory()" />
      <UiLuxInput v-model="searchInput" placeholder="Buscar por SKU, marca o modelo..." @input="onSearchInput" />

      <select v-model="query.brand" class="admin-filter-select">
        <option value="">Todas las marcas</option>
        <option v-for="brand in brands" :key="brand.id" :value="brand.slug">{{ brand.name }}</option>
      </select>
    </div>

    <AdminWatchTable
      :watches="watches"
      :loading="pending"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <div v-if="hasMore" class="admin-inventory-pagination">
      <button
        type="button"
        class="admin-pagination-btn"
        :disabled="pending"
        @click="loadMore"
      >
        {{ pending ? 'Cargando...' : 'Cargar más' }}
      </button>
      <span class="admin-pagination-info">
        Mostrando {{ watches.length }} de {{ total }}
      </span>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="admin-modal-backdrop" @click.self="showForm = false">
        <div class="admin-modal admin-modal--wide">
          <AdminWatchFormLazy
            :watch="editingWatch"
            :brands="brands ?? []"
            :categories="categories ?? []"
            :mechanisms="mechanisms ?? []"
            :care-templates="careTemplates ?? []"
            :saving="saving"
            :submit-error="submitError"
            @submit="handleSubmit"
            @cancel="showForm = false"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
.admin-inventory {
  max-width: 1400px;
}

.admin-inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.admin-inventory-toolbar {
  display: grid;
  grid-template-columns: 1fr 200px 200px;
  gap: 12px;
  margin-bottom: 20px;
}

.admin-filter-select {
  background: transparent;
  border: var(--border-hairline);
  padding: 12px 14px;
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white);
  outline: none;
}

.admin-filter-select:focus {
  border-color: rgba(200, 169, 110, 0.22);
}

.admin-filter-select option {
  background: var(--lux-black-2);
  color: var(--lux-white);
}

.admin-inventory-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.admin-pagination-btn {
  padding: 10px 18px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.admin-pagination-btn:hover:not(:disabled) {
  border-color: var(--lux-gold);
  color: var(--lux-gold);
}

.admin-pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.admin-pagination-info {
  font-family: var(--lux-font-body);
  font-size: 12px;
  color: var(--lux-white-dim);
}

.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.admin-modal {
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  background: var(--lux-black);
  border: 1px solid rgba(200, 169, 110, 0.15);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.admin-modal--wide {
  max-width: 900px;
}

@media (max-width: 768px) {
  .admin-inventory-toolbar {
    grid-template-columns: 1fr;
  }

  .admin-modal {
    max-height: 95vh;
  }
}
</style>



