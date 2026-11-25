<script setup lang="ts">
import type { BrandDto, CareTemplateDto, CategoryDto, MechanismDto, InventoryInsightsDto, PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { WatchStatus } from '@luxtime/shared';
import { extractApiErrorMessage, isAbortError, isBadRequest } from '~/utils/api-error';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { validateWatchVideoFile } from '~/utils/video-validation';
import { invalidateStorefrontCatalogCaches } from '~/utils/storefront-cache';
import { searchEmptyMessage } from '~/utils/search-empty';
import { INVENTORY_PAGE_SIZE, loadInventoryCount, mergeInventoryPage } from '~/utils/inventory-pagination';
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
  imagesOnly?: boolean;
};

useHead({ title: 'Inventario — LUXTIMEE Admin' });
definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();
const auth = useAuthStore();
const catalogStore = useAdminCatalogStore();

const loadedPages = ref(1);

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
  }, 300);
}

const listFilters = computed(() => ({
  search: query.search || undefined,
  brand: query.brand || undefined,
}));

const showForm = ref(false);
const editingWatch = ref<WatchStaffDto | null>(null);
const saving = ref(false);
const submitError = ref('');

const mediaQueue = useMediaUploadStore();
const bulkDelete = useWatchBulkDeleteStore();
const bulkDraft = useWatchBulkDraftStore();

async function removeFailedDraft(id: string) {
  const ok = await confirm('Se quita de la cola; no borra ningún reloj.');
  if (!ok) return;
  await bulkDraft.remove(id);
}

const selectionMode = ref(false);
const selectingAll = ref(false);
const selected = ref<Record<string, { model: string; brandName: string }>>({});
const labelsWatchIds = ref<string[] | null>(null);
let selectToken = 0;

function openLabels(ids: string[]) {
  if (!ids.length) return;
  labelsWatchIds.value = [...ids];
}

const selectedIds = computed(() => Object.keys(selected.value));
const selectedCount = computed(() => selectedIds.value.length);

const progressById = computed(() => {
  const map: Record<string, { status: string; progress: number }> = {};
  for (const job of bulkDelete.jobs) {
    map[job.id] = { status: job.status, progress: job.progress };
  }
  return map;
});

const brands = computed(() => catalogStore.brands);
const categories = computed(() => catalogStore.categories);
const mechanisms = computed(() => catalogStore.mechanisms);

// Brands/categories desde cache Pinia + watches en paralelo sin bloquear UI
const staffReady = computed(
  () => auth.loaded && auth.hasApiSession,
);

const paginated = ref<PaginatedResponse<WatchStaffDto> | null>(null);
const listPending = ref(false);
let listAbort: AbortController | null = null;
let listGeneration = 0;
let pendingToken = 0;

async function refreshWatches(silent = false, pages = loadedPages.value) {
  if (!staffReady.value) return;
  const generation = silent ? listGeneration : ++listGeneration;
  const token = silent ? 0 : ++pendingToken;
  let controller: AbortController | null = null;
  if (!silent) {
    listAbort?.abort();
    controller = new AbortController();
    listAbort = controller;
    listPending.value = true;
  }
  const filters = { ...listFilters.value };
  try {
    const loaded = await loadInventoryCount<WatchStaffDto>(
      Math.max(1, pages) * INVENTORY_PAGE_SIZE,
      (page, limit) => api.get<PaginatedResponse<WatchStaffDto>>(
        '/watches',
        { ...filters, page, limit },
        controller ? { signal: controller.signal } : undefined,
      ),
      { pageSize: 100, isStale: () => generation !== listGeneration },
    );
    if (loaded.stale || generation !== listGeneration) return;
    loadedPages.value = Math.max(1, Math.ceil(loaded.data.length / INVENTORY_PAGE_SIZE));
    paginated.value = {
      data: loaded.data,
      total: loaded.total,
      page: 1,
      limit: loaded.data.length || INVENTORY_PAGE_SIZE,
    };
  } catch (err: unknown) {
    if (generation !== listGeneration || isAbortError(err)) return;
    if (!silent) toast.error(extractApiErrorMessage(err, 'No se pudo cargar el inventario'));
  } finally {
    if (!silent && token === pendingToken) listPending.value = false;
  }
}

const insights = ref<InventoryInsightsDto | null>(null);
const insightsPending = ref(false);
let insightsAbort: AbortController | null = null;
let insightsRequest = 0;

async function refreshInsights() {
  if (!staffReady.value) return;
  const requestId = ++insightsRequest;
  insightsAbort?.abort();
  const controller = new AbortController();
  insightsAbort = controller;
  insightsPending.value = true;
  try {
    const res = await api.get<InventoryInsightsDto>(
      '/watches/inventory-insights',
      undefined,
      { signal: controller.signal },
    );
    if (requestId !== insightsRequest) return;
    insights.value = res;
  } catch (err: unknown) {
    if (requestId !== insightsRequest || isAbortError(err)) return;
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el inventario'));
  } finally {
    if (requestId === insightsRequest) insightsPending.value = false;
  }
}

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
    void refreshInsights();
    void refreshCare();
    void refreshWatches();
  }
}, { immediate: true });

watch(listFilters, () => {
  loadedPages.value = 1;
  if (staffReady.value) void refreshWatches(false, 1);
}, { deep: true });

useLiveRefresh(() => refreshWatches(true), {
  intervalMs: 30_000,
  pauseWhen: () =>
    showForm.value
    || saving.value
    || Boolean(labelsWatchIds.value)
    || bulkDelete.pendingCount > 0
    || bulkDraft.preparing
    || bulkDraft.confirming
    || Boolean(bulkDraft.board)
    || Boolean(bulkDraft.preview),
});

useAdminRefetchWhenAuthed([refreshWatches, refreshInsights, refreshCare, loadCatalogMeta]);

const watches = computed(() => paginated.value?.data ?? []);
const inventorySearchMiss = computed(() => searchEmptyMessage({
  term: query.search,
  pending: listPending.value,
  count: watches.value.length,
  message: 'No se encontraron relojes',
}));
const tableWatches = computed(() =>
  watches.value.filter((watch) => progressById.value[watch.id]?.status !== 'done'),
);
const offscreenJobs = computed(() => {
  const visible = new Set(tableWatches.value.map((watch) => watch.id));
  return bulkDelete.activeJobs.filter((job) => !visible.has(job.id));
});
const total = computed(() => paginated.value?.total ?? 0);
const hasMore = computed(() => watches.value.length < total.value);
const inventoryRefreshing = computed(() => insightsPending.value);

async function reloadInventory() {
  await Promise.all([refreshWatches(), refreshInsights()]);
}

async function loadMore() {
  if (listPending.value || !hasMore.value) return;
  const generation = ++listGeneration;
  const token = ++pendingToken;
  listAbort?.abort();
  const controller = new AbortController();
  listAbort = controller;
  listPending.value = true;
  const filters = { ...listFilters.value };
  const page = loadedPages.value + 1;
  try {
    const res = await api.get<PaginatedResponse<WatchStaffDto>>(
      '/watches',
      { ...filters, page, limit: INVENTORY_PAGE_SIZE },
      { signal: controller.signal },
    );
    if (generation !== listGeneration) return;
    const data = mergeInventoryPage(paginated.value?.data ?? [], res.data);
    loadedPages.value = page;
    paginated.value = {
      data,
      total: res.total,
      page: 1,
      limit: data.length || INVENTORY_PAGE_SIZE,
    };
  } catch (err: unknown) {
    if (generation !== listGeneration || isAbortError(err)) return;
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el inventario'));
  } finally {
    if (token === pendingToken) listPending.value = false;
  }
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

const route = useRoute();
watch(() => route.query.reloj, async (id) => {
  if (typeof id !== 'string' || !id || showForm.value) return;
  try {
    openEdit(await api.get<WatchStaffDto>(`/watches/${id}`));
  } catch {
    /* el aviso igual muestra el SKU */
  }
}, { immediate: true });

async function handleSubmit(form: WatchFormPayload) {
  if (saving.value) return;

  const isCreate = !editingWatch.value;
  const hasNewImages = !!(form.primaryImageFile && form.secondaryImageFile);
  const hasNewPrimaryImage = !!form.primaryImageFile;
  const hasNewSecondaryImage = !!form.secondaryImageFile;
  const hasVideo = !!form.videoFile;
  const hasNewMedia = hasNewPrimaryImage || hasNewSecondaryImage || hasVideo;
  const imagesOnly = !!(form.imagesOnly && isCreate);

  if (isCreate && !hasNewImages) {
    submitError.value = imagesOnly
      ? 'Debes subir foto principal y foto secundaria.'
      : 'Debes subir foto principal, foto secundaria y video.';
    toast.warning(submitError.value);
    return;
  }

  if (isCreate && !imagesOnly && !hasVideo) {
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

  if (imagesOnly && !(form.brandId || brands.value?.[0]?.id)) {
    submitError.value = 'No hay marcas registradas. Crea una marca antes de subir imágenes.';
    toast.warning(submitError.value);
    return;
  }

  saving.value = true;
  submitError.value = '';

  try {
    let watchId = editingWatch.value?.id;

    const draftMode = imagesOnly;
    const fallbackBrandId = form.brandId || brands.value?.[0]?.id;

    const payload: Record<string, unknown> = {
      brandId: draftMode ? fallbackBrandId : form.brandId,
      categoryId: form.categoryId || undefined,
      mechanismId: form.mechanismId || undefined,
      movementType: form.movementType || undefined,
      model: draftMode ? (form.model?.trim() || 'Pendiente de completar') : form.model,
      description: form.description,
      gender: form.gender,
      warrantyMonths: Number(form.warrantyMonths),
      retailPrice: draftMode ? 0 : Number(form.retailPrice),
      wholesalePrice: draftMode ? 0 : Number(form.wholesalePrice),
      stock: draftMode ? 0 : Number(form.stock),
      status: draftMode ? WatchStatus.AGOTADO : form.status,
      isLimitedEdition: form.isLimitedEdition,
      limitedEditionNumber: form.limitedEditionNumber,
      images: form.images,
      mainImageIndex: form.mainImageIndex,
      ...(draftMode
        ? { isPublished: false }
        : {
            isPublished: true,
            isActive: true,
          }),
      ...(watchId
        ? { careTemplateId: form.careTemplateId || '' }
        : form.careTemplateId
          ? { careTemplateId: form.careTemplateId }
          : {}),
    };

    if (form.cost !== undefined) {
      payload.cost = Number(form.cost);
    }

    const current = editingWatch.value;
    if (current && !hasNewPrimaryImage && form.primaryImageUrl) {
      const originalPrimary = current.primaryImageUrl || current.frontImageUrl || current.images?.[0];
      if (form.primaryImageUrl !== originalPrimary) payload.primaryImageUrl = form.primaryImageUrl;
    }
    if (current && !hasNewSecondaryImage && form.secondaryImageUrl) {
      const originalSecondary = current.secondaryImageUrl || current.backImageUrl || current.images?.[1];
      if (form.secondaryImageUrl !== originalSecondary) payload.secondaryImageUrl = form.secondaryImageUrl;
    }

    let brandName = brands.value?.find((b) => b.id === (draftMode ? fallbackBrandId : form.brandId))?.name ?? '';

    if (watchId) {
      const wasUnpublished = !editingWatch.value?.isPublished;
      const updated = await api.patch<WatchStaffDto>(`/watches/${watchId}`, payload);
      const publishedNow = wasUnpublished && updated.isPublished;
      toast.success(
        publishedNow
          ? 'Reloj completo — ya está publicado en el catálogo.'
          : hasNewMedia
            ? 'Reloj actualizado — multimedia en proceso...'
            : 'Reloj actualizado correctamente',
      );
    } else {
      const created = await api.post<WatchStaffDto>('/watches', payload);
      watchId = created.id;
      brandName = created.brand?.name ?? brandName;
      toast.success(draftMode ? 'Borrador creado — procesando imágenes...' : 'Reloj creado — multimedia en cola...');
    }

    // Cerrar modal INMEDIATAMENTE
    showForm.value = false;
    editingWatch.value = null;

    if (hasNewMedia && watchId) {
      mediaQueue.enqueue({
        watchId,
        model: form.model || 'Borrador',
        brandName,
        files: {
          ...(form.primaryImageFile ? { image1: form.primaryImageFile } : {}),
          ...(form.secondaryImageFile ? { image2: form.secondaryImageFile } : {}),
          ...(hasVideo ? { video: form.videoFile! } : {}),
        },
      });
    }

    invalidateAdminCachePrefix('admin-watches-');
    invalidateAdminCache('inventory-insights');
    invalidateStorefrontCatalogCaches();
    void refreshWatches();
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
    title: `¿Quitar del inventario ${watch.brand.name} ${watch.model}?`,
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    await api.del(`/watches/${watch.id}`);
    toast.success('Reloj eliminado correctamente');
    invalidateAdminCachePrefix('admin-watches-');
    invalidateAdminCache('inventory-insights');
    await refreshWatches();
    await refreshInsights();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'Error al eliminar el reloj'));
  }
}

function exitSelection() {
  selectToken += 1;
  selectingAll.value = false;
  selectionMode.value = false;
  selected.value = {};
}

function withoutSelected(id: string) {
  return Object.fromEntries(Object.entries(selected.value).filter(([key]) => key !== id));
}

function toggleSelect(watch: WatchStaffDto) {
  if (selected.value[watch.id]) {
    selected.value = withoutSelected(watch.id);
    return;
  }
  selected.value = {
    ...selected.value,
    [watch.id]: { model: watch.model, brandName: watch.brand.name },
  };
}

function toggleVisible(on: boolean) {
  if (!on) {
    const hidden = new Set(tableWatches.value.map((watch) => watch.id));
    selected.value = Object.fromEntries(
      Object.entries(selected.value).filter(([id]) => !hidden.has(id)),
    );
    return;
  }
  const next = { ...selected.value };
  for (const watch of tableWatches.value) {
    next[watch.id] = { model: watch.model, brandName: watch.brand.name };
  }
  selected.value = next;
}

async function selectAllFiltered() {
  const token = ++selectToken;
  selectingAll.value = true;
  try {
    const collected: Record<string, { model: string; brandName: string }> = {};
    let page = 1;
    for (;;) {
      const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
        search: query.search || undefined,
        brand: query.brand || undefined,
        page,
        limit: 100,
      });
      if (token !== selectToken) return;
      for (const watch of res.data) {
        collected[watch.id] = { model: watch.model, brandName: watch.brand.name };
      }
      if (res.data.length < 100 || Object.keys(collected).length >= res.total) break;
      page += 1;
    }
    if (token === selectToken) selected.value = collected;
  } catch (err: unknown) {
    if (token === selectToken) toast.error(extractApiErrorMessage(err, 'No se pudo seleccionar el inventario'));
  } finally {
    if (token === selectToken) selectingAll.value = false;
  }
}

async function handleBulkDelete() {
  const items = Object.entries(selected.value).map(([id, meta]) => ({ id, ...meta }));
  if (!items.length) return;
  const ok = await confirm({
    title: `¿Quitar del inventario ${items.length} relojes?`,
    message: 'Puedes seguir navegando mientras se eliminan.',
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  selected.value = {};
  bulkDelete.enqueue(items);
}

watch(() => bulkDelete.pendingCount, (n, prev) => {
  if ((prev ?? 0) > 0 && n === 0) void finishBulkDelete();
});

const router = useRouter();
const seenBulkSettlement = ref(0);

async function consumeBulkSettlement() {
  if (!router.currentRoute.value.path.startsWith('/admin/inventario')) return;
  const settlement = bulkDraft.settlement;
  if (!settlement) return;
  if (settlement.seq === seenBulkSettlement.value || settlement.seq === bulkDraft.ackedSettlement) {
    seenBulkSettlement.value = settlement.seq;
    return;
  }
  seenBulkSettlement.value = settlement.seq;
  bulkDraft.ackSettlement(settlement.seq);
  const { done, failed } = settlement;
  await refreshWatches();
  await refreshInsights();
  if (failed && done) toast.warning(`${done} borradores listos. ${failed} pares fallaron.`);
  else if (failed) toast.warning(failed === 1 ? 'No se pudo crear el borrador.' : `${failed} pares no se pudieron crear.`);
  else if (done) toast.success(done === 1 ? 'Borrador creado' : `${done} borradores creados`);
}

watch(() => bulkDraft.settlement?.seq ?? 0, () => {
  void consumeBulkSettlement();
}, { immediate: true });
watch(() => router.currentRoute.value.path, () => {
  void consumeBulkSettlement();
});
onActivated(() => {
  void consumeBulkSettlement();
});

async function finishBulkDelete() {
  const failed = bulkDelete.failedCount;
  const done = bulkDelete.doneCount;
  invalidateAdminCachePrefix('admin-watches-');
  invalidateAdminCache('inventory-insights');
  invalidateStorefrontCatalogCaches();
  await refreshWatches();
  await refreshInsights();
  if (failed) toast.warning(`${done} eliminados. ${failed} no se pudieron eliminar.`);
  else if (done) toast.success(done === 1 ? 'Reloj eliminado correctamente' : `${done} relojes eliminados`);
  bulkDelete.clearFinished();
}

</script>

<template>
  <div class="admin-inventory">
    <div class="admin-inventory-header">
      <UiSectionHeader
        label="Operaciones"
        title="Inventario de relojes"
      />
      <div class="admin-inventory-actions">
        <button type="button" class="admin-pagination-btn" @click="selectionMode ? exitSelection() : (selectionMode = true)">
          {{ selectionMode ? 'Cerrar selección' : 'Selección' }}
        </button>
        <div class="admin-inventory-create">
          <UiLuxButton @click="openCreate">+ Nuevo Reloj</UiLuxButton>
          <AdminBulkDraft />
          <AdminImportPhotosByKey />
        </div>
      </div>
    </div>

    <AdminInventoryInsights :insights="insights" :loading="insightsPending" />

    <p class="admin-inventory-hint">Si el inventario no carga o no se muestra, pulsa Actualizar.</p>

    <div class="admin-inventory-toolbar">
      <UiAdminRefreshButton :loading="inventoryRefreshing" @click="reloadInventory()" />
      <div class="admin-inventory-search">
        <UiLuxInput v-model="searchInput" placeholder="Buscar por SKU, marca o modelo..." @input="onSearchInput" />
        <p v-if="listPending && watches.length" class="admin-search-pending" role="status">Buscando...</p>
        <p v-if="inventorySearchMiss" class="admin-search-empty" role="status">{{ inventorySearchMiss }}</p>
      </div>

      <select v-model="query.brand" class="admin-filter-select">
        <option value="">Todas las marcas</option>
        <option v-for="brand in brands" :key="brand.id" :value="brand.slug">{{ brand.name }}</option>
      </select>
    </div>

    <div v-if="selectionMode" class="admin-selection-bar">
      <button type="button" class="admin-pagination-btn" :disabled="selectingAll || !total" @click="selectAllFiltered">
        {{ selectingAll ? 'Seleccionando...' : `Seleccionar todos (${total})` }}
      </button>
      <span class="admin-pagination-info">{{ selectedCount }} seleccionados</span>
      <button type="button" class="admin-pagination-btn" :disabled="!selectedCount" @click="openLabels(selectedIds)">
        Imprimir etiquetas ({{ selectedCount }})
      </button>
      <button type="button" class="admin-pagination-btn admin-pagination-btn--danger" :disabled="!selectedCount" @click="handleBulkDelete">
        Eliminar
      </button>
    </div>

    <ul v-if="offscreenJobs.length || bulkDraft.activeJobs.length" class="admin-bulk-progress">
      <li v-for="job in offscreenJobs" :key="job.id">
        <span>{{ job.brandName }} {{ job.model }}</span>
        <span class="admin-watch-progress" :class="{ 'admin-watch-progress--error': job.status === 'error' }">
          <span :style="{ width: `${job.progress}%` }" />
        </span>
      </li>
      <li v-for="job in bulkDraft.activeJobs" :key="`draft-${job.id}`">
        <span>{{ job.backName ? `${job.frontName} + ${job.backName}` : job.frontName }}</span>
        <span class="admin-watch-progress" :class="{ 'admin-watch-progress--error': job.status === 'error' }">
          <span :style="{ width: `${job.progress}%` }" />
        </span>
        <span v-if="job.status === 'error' && job.errorMessage" class="admin-bulk-draft-reason">{{ job.errorMessage }}</span>
        <button
          v-if="job.status === 'error'"
          type="button"
          class="admin-pagination-btn"
          @click="bulkDraft.retry(job.id)"
        >
          Reintentar
        </button>
        <button
          v-if="job.status === 'error'"
          type="button"
          class="admin-pagination-btn"
          @click="removeFailedDraft(job.id)"
        >
          Quitar
        </button>
      </li>
    </ul>

    <AdminWatchTable
      :watches="tableWatches"
      :loading="listPending && !watches.length"
      :selection-mode="selectionMode"
      :selected-ids="selectedIds"
      :progress-by-id="progressById"
      @edit="openEdit"
      @delete="handleDelete"
      @labels="(watch) => openLabels([watch.id])"
      @toggle-select="toggleSelect"
      @toggle-visible="toggleVisible"
    />

    <AdminLabelsModal
      v-if="labelsWatchIds"
      :watch-ids="labelsWatchIds"
      @close="labelsWatchIds = null"
    />

    <div v-if="hasMore" class="admin-inventory-pagination">
      <button
        type="button"
        class="admin-pagination-btn"
        :disabled="listPending"
        @click="loadMore"
      >
        {{ listPending ? 'Cargando...' : 'Cargar más' }}
      </button>
      <span class="admin-pagination-info">
        Mostrando {{ watches.length }} de {{ total }}
      </span>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="admin-modal-backdrop" @click.self="showForm = false">
        <div class="admin-modal admin-modal--wide">
          <AdminWatchFormLazy
            :key="editingWatch?.id ?? 'new'"
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

.admin-inventory-actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  max-width: 100%;
}

.admin-inventory-create {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.admin-inventory-create .admin-bulk-draft {
  width: 100%;
  margin-bottom: 0;
}

.admin-inventory-create > button,
.admin-inventory-create .admin-bulk-draft > button {
  width: 100%;
}

.admin-selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.admin-pagination-btn--danger:hover:not(:disabled) {
  border-color: #ff5555;
  color: #ff5555;
}

.admin-bulk-progress {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  max-height: 160px;
  overflow: auto;
  border: var(--border-hairline);
}

.admin-bulk-progress li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--lux-white);
}

.admin-bulk-draft-reason {
  grid-column: 1 / -1;
  color: #ff8888;
  line-height: 1.3;
}

.admin-watch-progress {
  height: 3px;
  background: rgba(200, 169, 110, 0.15);
  overflow: hidden;
}

.admin-watch-progress > span {
  display: block;
  height: 100%;
  background: #c8a96e;
}

.admin-watch-progress--error > span {
  background: #ff5555;
}

.admin-inventory-hint {
  margin: 0 0 10px;
  padding: 8px 12px;
  max-width: 100%;
  font-family: var(--lux-font-body);
  font-size: 12px;
  line-height: 1.4;
  color: var(--lux-white-dim);
  border: 1px solid rgba(200, 169, 110, 0.28);
  background: rgba(200, 169, 110, 0.08);
}

.admin-inventory-toolbar {
  display: grid;
  grid-template-columns: auto minmax(240px, 1fr) minmax(180px, 240px);
  gap: 12px;
  margin-bottom: 20px;
  align-items: start;
}

.admin-search-pending {
  margin: 8px 0 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--lux-gold, #c9a84c);
}

.admin-inventory-search {
  min-width: 0;
}

@media (max-width: 820px) {
  .admin-inventory-toolbar {
    grid-template-columns: 1fr;
  }
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
  background: rgba(20, 20, 20, 0.35);
  backdrop-filter: blur(4px);
}

.admin-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  background: var(--lux-black-2);
  border: 1px solid rgba(200, 169, 110, 0.2);
  box-shadow: 0 24px 64px rgba(20, 20, 20, 0.12);
  overflow: hidden;
  min-height: 0;
}

.admin-modal--wide {
  max-width: 900px;
}

@media (max-width: 768px) {
  .admin-inventory-header,
  .admin-inventory-actions,
  .admin-inventory-create,
  .admin-inventory-pagination {
    width: 100%;
  }

  .admin-inventory-toolbar {
    grid-template-columns: 1fr;
  }

  .admin-inventory-pagination {
    flex-wrap: wrap;
  }

  .admin-bulk-progress li {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-modal {
    max-height: 100dvh;
    max-width: 100%;
  }

  .admin-modal-backdrop {
    padding: 8px;
    align-items: flex-end;
  }
}
</style>



