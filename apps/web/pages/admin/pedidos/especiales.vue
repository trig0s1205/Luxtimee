<script setup lang="ts">
import type {
  CreateSpecialSaleDto,
  PaginatedResponse,
  SpecialSaleDto,
  SpecialSalesListDto,
  WatchStaffDto,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const PAGE_SIZE = 20;
const page = ref(1);
const searchInput = ref('');
const search = ref('');
const salePrice = ref<number | null>(null);
const note = ref('');
const saving = ref(false);
const deletingId = ref<string | null>(null);
const formError = ref('');

const selected = ref<WatchStaffDto | null>(null);
const watchSearch = ref('');
const searchResults = ref<WatchStaffDto[]>([]);
const searchPending = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const emptyList: SpecialSalesListDto = { items: [], total: 0, page: 1, limit: PAGE_SIZE };

const dataKey = computed(
  () => `admin-special-sales-${page.value}-${search.value}`,
);

const { data, refresh, pending } = useAdminCachedData(
  dataKey,
  () =>
    api
      .get<SpecialSalesListDto>('/orders/special-sales', {
        page: page.value,
        limit: PAGE_SIZE,
        search: search.value || undefined,
      })
      .catch(() => emptyList),
  { watch: [dataKey] },
);

const sales = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const previewProfit = computed(() => {
  const cost = selected.value?.cost;
  const price = Number(salePrice.value);
  if (cost == null || !Number.isInteger(price) || price <= 0) return null;
  return price - cost;
});

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function scheduleWatchSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runWatchSearch, 300);
}

async function runWatchSearch() {
  const term = watchSearch.value.trim();
  if (term.length < 2) {
    searchResults.value = [];
    return;
  }
  searchPending.value = true;
  try {
    const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
      search: term,
      page: 1,
      limit: 8,
    });
    searchResults.value = res.data;
  } catch {
    searchResults.value = [];
  } finally {
    searchPending.value = false;
  }
}

function selectWatch(watch: WatchStaffDto) {
  if ((watch.stock ?? 0) <= 0) {
    toast.error('Sin stock para este reloj');
    return;
  }
  selected.value = watch;
  watchSearch.value = '';
  searchResults.value = [];
  formError.value = '';
}

function clearWatch() {
  selected.value = null;
}

function applySearch() {
  search.value = searchInput.value.trim();
  page.value = 1;
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
}

function invalidateRelated() {
  invalidateAdminCache(dataKey.value);
  invalidateAdminCachePrefix('admin-special-sales-');
  invalidateAdminCachePrefix('admin-watches-');
  invalidateAdminCachePrefix('inventory-');
  invalidateAdminCachePrefix('profit-dashboard-');
}

async function submit() {
  formError.value = '';
  if (!selected.value) {
    formError.value = 'Selecciona un reloj del inventario';
    return;
  }
  const price = Number(salePrice.value);
  if (!Number.isInteger(price) || price <= 0) {
    formError.value = 'El precio de venta debe ser mayor a 0';
    return;
  }
  if (!note.value.trim()) {
    formError.value = 'La nota es obligatoria';
    return;
  }
  if ((selected.value.stock ?? 0) <= 0) {
    formError.value = 'Sin stock para este reloj';
    return;
  }

  saving.value = true;
  try {
    const payload: CreateSpecialSaleDto = {
      watchId: selected.value.id,
      salePrice: price,
      note: note.value.trim(),
    };
    await api.post<SpecialSaleDto>('/orders/special-sales', payload);
    toast.success('Venta especial registrada');
    selected.value = null;
    salePrice.value = null;
    note.value = '';
    page.value = 1;
    invalidateRelated();
    await refresh();
  } catch (err: unknown) {
    formError.value = extractApiErrorMessage(err, 'No se pudo registrar la venta');
  } finally {
    saving.value = false;
  }
}

async function removeSale(sale: SpecialSaleDto) {
  const ok = await confirm({
    title: 'Eliminar venta especial',
    message: `¿Eliminar la venta de ${sale.sku}? El stock del reloj se restaura.`,
    confirmLabel: 'Eliminar',
    destructive: true,
  });
  if (!ok) return;
  deletingId.value = sale.id;
  try {
    await api.del(`/orders/${sale.id}`);
    toast.success(`Venta eliminada — ${sale.sku}`);
    invalidateRelated();
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar la venta'));
  } finally {
    deletingId.value = null;
  }
}

useSeoMeta({ title: 'Ventas especiales — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiToastContainer />
    <UiSectionHeader label="Pedidos" title="Ventas especiales" />
    <p class="admin-records-hint">
      Venta directa de un reloj del inventario, sin cliente. El precio que escribas es el de la venta y descuenta una unidad.
    </p>

    <form class="admin-record-card special-form" @submit.prevent="submit">
      <h3 class="admin-record-title">Nueva venta</h3>
      <UiLuxInput
        v-model="watchSearch"
        placeholder="Buscar reloj por marca, modelo o SKU..."
        @input="scheduleWatchSearch"
      />
      <p v-if="searchPending" class="admin-record-muted">Buscando...</p>
      <ul v-if="searchResults.length" class="admin-record-list special-results">
        <li v-for="watch in searchResults" :key="watch.id">
          <button type="button" class="admin-record-btn admin-record-btn--ghost special-result" @click="selectWatch(watch)">
            {{ watch.brand.name }} {{ watch.model }} · {{ watch.sku }} · {{ formatCop(watch.retailPrice) }} · Stock {{ watch.stock }}
          </button>
        </li>
      </ul>

      <div v-if="selected" class="special-selected">
        <div>
          <p class="admin-record-title">{{ selected.brand.name }} {{ selected.model }}</p>
          <p class="admin-record-muted">
            SKU {{ selected.sku }} · Lista {{ formatCop(selected.retailPrice) }} · Stock {{ selected.stock }}
            <template v-if="selected.cost != null"> · Costo {{ formatCop(selected.cost) }}</template>
          </p>
        </div>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="clearWatch">
          Quitar
        </button>
      </div>
      <p v-else class="admin-record-empty">Selecciona un reloj del inventario.</p>

      <label class="special-label" for="special-price">Precio de venta (COP)</label>
      <input
        id="special-price"
        v-model.number="salePrice"
        type="number"
        min="1"
        step="1"
        placeholder="Ej. 30000"
        class="special-input"
      >

      <label class="special-label" for="special-note">Nota</label>
      <textarea
        id="special-note"
        v-model="note"
        rows="2"
        maxlength="500"
        required
        placeholder="Ej. mamá de Álvaro"
        class="admin-record-textarea"
      />

      <p v-if="previewProfit != null" class="admin-record-muted">
        Ganancia: {{ formatCop(previewProfit) }}
      </p>
      <p v-else-if="selected && selected.cost == null" class="admin-record-muted">
        La ganancia se calcula con el costo del inventario al guardar.
      </p>
      <p v-if="formError" class="special-error">{{ formError }}</p>

      <button type="submit" class="admin-record-btn admin-record-btn--primary" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Registrar venta' }}
      </button>
    </form>

    <div class="admin-records-toolbar">
      <UiAdminRefreshButton :loading="pending" @click="refresh()" />
      <form class="special-search" @submit.prevent="applySearch">
        <UiLuxInput v-model="searchInput" placeholder="Buscar por nota, reloj o SKU" />
        <button type="submit" class="admin-record-btn">Buscar</button>
      </form>
    </div>

    <div v-if="pending && !sales.length" class="admin-record-empty">Cargando ventas especiales...</div>

    <div v-else class="special-table-wrap">
      <table class="special-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Reloj</th>
            <th>SKU</th>
            <th>Precio lista</th>
            <th>Precio venta</th>
            <th>Costo</th>
            <th>Ganancia</th>
            <th>Nota</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!sales.length">
            <td colspan="9" class="admin-record-empty">
              {{ search ? 'Ninguna venta especial coincide con la búsqueda.' : 'Aún no hay ventas especiales.' }}
            </td>
          </tr>
          <tr v-for="sale in sales" :key="sale.id">
            <td>{{ formatDate(sale.createdAt) }}</td>
            <td>{{ sale.watchName }}</td>
            <td class="special-sku">{{ sale.sku }}</td>
            <td>{{ formatCop(sale.listPrice) }}</td>
            <td>{{ formatCop(sale.salePrice) }}</td>
            <td>{{ formatCop(sale.cost) }}</td>
            <td>{{ formatCop(sale.profit) }}</td>
            <td>{{ sale.note }}</td>
            <td>
              <button
                type="button"
                class="admin-record-btn admin-record-btn--ghost"
                :disabled="deletingId === sale.id"
                @click="removeSale(sale)"
              >
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="special-pager">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="admin-records-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">
        Siguiente
      </button>
    </div>
  </div>
</template>

<style scoped>
.special-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  margin: 16px 0 24px;
}

.special-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #aaa);
}

.special-input {
  width: 100%;
  max-width: 280px;
  background: var(--lux-black-2, #111);
  border: 1px solid rgba(200, 169, 110, 0.2);
  padding: 12px 14px;
  font-size: 0.9rem;
}

.special-results {
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.special-result {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}

.special-selected {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid rgba(200, 169, 110, 0.15);
  padding: 12px;
}

.special-error {
  color: #f87171;
  font-size: 0.85rem;
}

.special-search {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.special-table-wrap {
  overflow-x: auto;
  max-width: 100%;
}

.special-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
}

.special-table th,
.special-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--lux-border, #2a2a2a);
  font-size: 0.85rem;
  vertical-align: top;
}

.special-table th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--lux-muted, #888);
  white-space: nowrap;
}

.special-sku {
  font-family: monospace;
}

.special-pager {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}
</style>
