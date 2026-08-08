<script setup lang="ts">
import type { BrandDto, CategoryDto, InventoryInsightsDto, PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { WatchStatus } from '@luxtime/shared';
import { extractApiErrorMessage, isBadRequest } from '~/utils/api-error';

type WatchFormPayload = {
  brandId: string;
  categoryId?: string;
  model: string;
  reference?: string;
  description?: string;
  gender?: string;
  warrantyMonths: number;
  waterResistance?: string;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  profitPercent?: number;
  retailMarginPercentage?: number;
  wholesaleMarginPercentage?: number;
  stock: number;
  status: WatchStatus;
  showInCatalog: boolean;
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
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const auth = useAuthStore();

const { data: insights, pending: insightsPending, refresh: refreshInsights } = await useAsyncData(
  'inventory-insights',
  () => api.get<InventoryInsightsDto>('/watches/inventory-insights'),
);

const PAGE_SIZE = 30;
const loadPages = ref(1);

const query = reactive({
  search: '',
  brand: '',
});

const fetchQuery = computed(() => ({
  search: query.search || undefined,
  brand: query.brand || undefined,
  page: 1,
  limit: PAGE_SIZE * loadPages.value,
}));

const showForm = ref(false);
const editingWatch = ref<WatchStaffDto | null>(null);
const saving = ref(false);
const uploading = ref(false);
const submitError = ref('');

const { data: brands } = await useAsyncData('admin-brands', () =>
  api.get<BrandDto[]>('/brands').catch(() => []),
);

const { data: categories } = await useAsyncData('admin-categories', () =>
  api.get<CategoryDto[]>('/categories').catch(() => []),
);

const { data: paginated, refresh, pending } = await useAsyncData(
  'admin-watches',
  () => api.get<PaginatedResponse<WatchStaffDto>>('/watches', fetchQuery.value as Record<string, string | number | boolean | undefined>).catch(() => ({ data: [], total: 0, page: 1, limit: PAGE_SIZE })),
  { watch: [() => query.search, () => query.brand, () => loadPages.value] },
);

const watches = computed(() => paginated.value?.data ?? []);
const total = computed(() => paginated.value?.total ?? 0);
const hasMore = computed(() => watches.value.length < total.value);

watch([() => query.search, () => query.brand], () => {
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
  if (saving.value || uploading.value) return;

  const isCreate = !editingWatch.value;

  if (isCreate && (!form.primaryImageFile || !form.secondaryImageFile || !form.videoFile)) {
    submitError.value = 'Debes subir foto principal, foto secundaria y video.';
    toast.warning(submitError.value);
    return;
  }

  saving.value = true;
  submitError.value = '';
  let createdWatchId: string | undefined;

  try {
    let watchId = editingWatch.value?.id;
    const payload: Record<string, unknown> = {
      brandId: form.brandId,
      categoryId: form.categoryId || undefined,
      model: form.model,
      reference: form.reference,
      description: form.description,
      gender: form.gender,
      warrantyMonths: Number(form.warrantyMonths),
      waterResistance: form.waterResistance,
      retailPrice: Number(form.retailPrice),
      wholesalePrice: Number(form.wholesalePrice),
      stock: Number(form.stock),
      status: form.status,
      showInCatalog: form.showInCatalog,
      isLimitedEdition: form.isLimitedEdition,
      limitedEditionNumber: form.limitedEditionNumber,
      images: form.images,
      mainImageIndex: form.mainImageIndex,
    };

    if (auth.isSuperAdmin && form.cost !== undefined) {
      payload.cost = Number(form.cost);
    } else if (!auth.isSuperAdmin && editingWatch.value && Number(form.cost) === 0) {
      payload.cost = 0;
    }

    if (watchId) {
      await api.patch<WatchStaffDto>(`/watches/${watchId}`, payload);
      toast.success('Reloj actualizado correctamente');
    } else {
      const created = await api.post<WatchStaffDto>('/watches', payload);
      watchId = created.id;
      createdWatchId = created.id;
      editingWatch.value = created;
      toast.success('Reloj creado correctamente');
    }

    if (watchId && form.primaryImageFile && form.secondaryImageFile && form.videoFile) {
      uploading.value = true;
      const fd = new FormData();
      fd.append('image1', form.primaryImageFile);
      fd.append('image2', form.secondaryImageFile);
      fd.append('video', form.videoFile);
      const config = useRuntimeConfig();
      await $fetch(`${config.public.apiBaseUrl}/watches/${watchId}/upload-media`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        timeout: 300_000,
      });
      toast.success('Multimedia subida correctamente');
    }

    showForm.value = false;
    editingWatch.value = null;
    await refresh();
    await refreshInsights();
  } catch (err: unknown) {
    const message = extractApiErrorMessage(err, 'Error al guardar el reloj');
    submitError.value = message;
    if (isBadRequest(err)) toast.warning(message);
    else toast.error(message);

    if (createdWatchId) {
      toast.info('El reloj fue creado pero falló la subida de multimedia. Corrige los archivos y vuelve a guardar.');
    }
  } finally {
    saving.value = false;
    uploading.value = false;
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
      <UiSectionHeader label="Operaciones" title="Inventario de relojes" />
      <UiLuxButton @click="openCreate">+ Nuevo Reloj</UiLuxButton>
    </div>

    <AdminInventoryInsights :insights="insights" :loading="insightsPending" />

    <div class="admin-inventory-toolbar">
      <UiLuxInput v-model="query.search" placeholder="Buscar por SKU, referencia o modelo..." />

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
          <AdminWatchForm
            :watch="editingWatch"
            :brands="brands ?? []"
            :categories="categories ?? []"
            :saving="saving"
            :uploading="uploading"
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
