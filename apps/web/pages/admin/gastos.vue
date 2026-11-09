<script setup lang="ts">
import type { ExpenseDto, ExpensesListDto } from '@luxtime/shared';
import { ExpenseOrigin, EXPENSE_ORIGIN_LABELS } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';
import { invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { searchEmptyMessage } from '~/utils/search-empty';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const PAGE_SIZE = 20;
const page = ref(1);
const searchInput = ref('');
const search = ref('');
const originFilter = ref<'' | ExpenseOrigin>('');
const saving = ref(false);
const deletingId = ref<string | null>(null);
const editingId = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const form = reactive({
  name: '',
  description: '',
  amount: null as number | null,
  spentAt: bogotaToday(),
  origin: ExpenseOrigin.PLATAFORMA as ExpenseOrigin,
});

const emptyList: ExpensesListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalAmount: 0,
  totalsByOrigin: { PLATAFORMA: 0, LOCAL: 0 },
};
const dataKey = computed(
  () => `admin-expenses-${page.value}-${search.value}-${originFilter.value}`,
);

const { data, refresh, pending } = useAdminCachedData(
  dataKey,
  () =>
    api.get<ExpensesListDto>('/expenses', {
      page: page.value,
      limit: PAGE_SIZE,
      search: search.value || undefined,
      origin: originFilter.value || undefined,
    }).catch(() => emptyList),
  { watch: [dataKey] },
);

const expenses = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalsByOrigin = computed(() => data.value?.totalsByOrigin ?? emptyList.totalsByOrigin);
const grandTotal = computed(
  () => totalsByOrigin.value.PLATAFORMA + totalsByOrigin.value.LOCAL,
);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const searchMiss = computed(() => searchEmptyMessage({
  term: search.value,
  pending: pending.value,
  count: expenses.value.length,
  message: 'No se encontraron gastos',
}));

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isoDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function originLabel(origin: ExpenseOrigin) {
  return EXPENSE_ORIGIN_LABELS[origin] ?? origin;
}

function originTone(origin: ExpenseOrigin): 'nacional' | 'local' {
  return origin === ExpenseOrigin.LOCAL ? 'local' : 'nacional';
}

function resetForm() {
  editingId.value = null;
  form.name = '';
  form.description = '';
  form.amount = null;
  form.spentAt = bogotaToday();
  form.origin = ExpenseOrigin.PLATAFORMA;
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    search.value = searchInput.value.trim();
    page.value = 1;
  }, 300);
}

function onOriginFilterChange() {
  page.value = 1;
}

function editExpense(expense: ExpenseDto) {
  editingId.value = expense.id;
  form.name = expense.name;
  form.description = expense.description ?? '';
  form.amount = expense.amount;
  form.spentAt = isoDate(expense.spentAt);
  form.origin = expense.origin ?? ExpenseOrigin.PLATAFORMA;
}

async function save() {
  const name = form.name.trim();
  const amount = Number(form.amount);
  if (!name) {
    toast.warning('El nombre es obligatorio.');
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    toast.warning('El valor debe ser mayor a 0.');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name,
      description: form.description.trim(),
      amount,
      spentAt: form.spentAt || bogotaToday(),
      origin: form.origin,
    };
    if (editingId.value) {
      await api.patch(`/expenses/${editingId.value}`, payload);
      toast.success('Gasto actualizado.');
    } else {
      await api.post('/expenses', payload);
      toast.success('Gasto registrado.');
    }
    resetForm();
    invalidateAdminCachePrefix('admin-expenses-');
    invalidateAdminCachePrefix('expenses-summary-');
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar el gasto.'));
  } finally {
    saving.value = false;
  }
}

async function removeExpense(expense: ExpenseDto) {
  const ok = await confirm({
    title: `¿Eliminar ${expense.name}?`,
    message: 'Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    destructive: true,
  });
  if (!ok) return;
  deletingId.value = expense.id;
  try {
    await api.del(`/expenses/${expense.id}`);
    if (editingId.value === expense.id) resetForm();
    toast.success('Gasto eliminado.');
    invalidateAdminCachePrefix('admin-expenses-');
    invalidateAdminCachePrefix('expenses-summary-');
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar el gasto.'));
  } finally {
    deletingId.value = null;
  }
}

useSeoMeta({ title: 'Gastos — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader label="Finanzas" :title="`Gastos (${total})`" />
    <p class="admin-record-muted">Los gastos se muestran aparte y no se restan de la ganancia.</p>

    <div class="admin-expenses-totals">
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Plataforma</p>
        <p class="admin-record-amount">{{ formatCop(totalsByOrigin.PLATAFORMA) }}</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Local</p>
        <p class="admin-record-amount">{{ formatCop(totalsByOrigin.LOCAL) }}</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Total</p>
        <p class="admin-record-amount">{{ formatCop(grandTotal) }}</p>
      </article>
    </div>

    <form class="admin-record-card p-5 space-y-4" @submit.prevent="save">
      <h2 class="admin-record-title">{{ editingId ? 'Editar gasto' : 'Registrar gasto' }}</h2>
      <label class="block space-y-2">
        <span class="text-xs uppercase tracking-widest text-lux-white-dim">Nombre</span>
        <UiLuxInput v-model="form.name" placeholder="Tijeras, cinta, bolsas..." required maxlength="120" />
      </label>
      <label class="block space-y-2">
        <span class="text-xs uppercase tracking-widest text-lux-white-dim">Descripción (opcional)</span>
        <textarea v-model="form.description" rows="2" maxlength="500" class="admin-record-textarea" />
      </label>
      <div class="grid gap-4 md:grid-cols-3">
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Valor (COP)</span>
          <input
            v-model.number="form.amount"
            type="number"
            min="1"
            step="1"
            required
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
          >
        </label>
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Fecha</span>
          <input
            v-model="form.spentAt"
            type="date"
            required
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
          >
        </label>
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Origen</span>
          <select v-model="form.origin" class="admin-record-select w-full" required>
            <option :value="ExpenseOrigin.PLATAFORMA">{{ EXPENSE_ORIGIN_LABELS.PLATAFORMA }}</option>
            <option :value="ExpenseOrigin.LOCAL">{{ EXPENSE_ORIGIN_LABELS.LOCAL }}</option>
          </select>
        </label>
      </div>
      <div class="admin-record-actions">
        <button type="submit" class="admin-record-btn admin-record-btn--primary" :disabled="saving">
          {{ saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar gasto' }}
        </button>
        <button v-if="editingId" type="button" class="admin-record-btn admin-record-btn--ghost" @click="resetForm">
          Cancelar
        </button>
      </div>
    </form>

    <div class="admin-orders-search admin-expenses-toolbar">
      <UiLuxInput v-model="searchInput" placeholder="Buscar por nombre o descripción..." @input="onSearchInput" />
      <select v-model="originFilter" class="admin-filter-select" @change="onOriginFilterChange">
        <option value="">Todos los orígenes</option>
        <option :value="ExpenseOrigin.PLATAFORMA">{{ EXPENSE_ORIGIN_LABELS.PLATAFORMA }}</option>
        <option :value="ExpenseOrigin.LOCAL">{{ EXPENSE_ORIGIN_LABELS.LOCAL }}</option>
      </select>
      <p v-if="searchMiss" class="admin-search-empty" role="status">{{ searchMiss }}</p>
    </div>

    <div v-if="pending && !expenses.length" class="admin-record-empty">Cargando gastos...</div>

    <div v-else class="admin-records-list">
      <article v-for="expense in expenses" :key="expense.id" class="admin-record-card">
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ expense.name }}</span>
              <span v-if="expense.description" class="admin-record-subtitle">{{ expense.description }}</span>
            </div>
            <UiLuxBadge :tone="originTone(expense.origin)">{{ originLabel(expense.origin) }}</UiLuxBadge>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(expense.amount) }}</span>
            <span class="admin-record-date">{{ formatDate(expense.spentAt) }}</span>
            <span v-if="expense.createdByName" class="admin-record-muted">{{ expense.createdByName }}</span>
          </div>
          <div class="admin-record-summary-actions">
            <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="editExpense(expense)">
              Editar
            </button>
            <button
              type="button"
              class="admin-record-btn admin-record-btn--danger"
              :disabled="deletingId === expense.id"
              @click="removeExpense(expense)"
            >
              {{ deletingId === expense.id ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </article>
      <p v-if="!expenses.length && !search" class="admin-record-empty">No hay gastos registrados.</p>
    </div>

    <nav v-if="totalPages > 1" class="admin-records-pagination" aria-label="Paginación de gastos">
      <button type="button" class="admin-records-page-btn" :disabled="page <= 1 || pending" @click="page--">
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="admin-records-page-btn" :disabled="page >= totalPages || pending" @click="page++">
        Siguiente
      </button>
    </nav>
  </div>
</template>

<style scoped>
.admin-expenses-totals {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 1rem;
}

.admin-expenses-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.admin-record-select,
.admin-filter-select {
  background: var(--lux-black-2, #141414);
  border: 1px solid rgba(200, 169, 110, 0.2);
  color: inherit;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .admin-expenses-totals {
    grid-template-columns: 1fr;
  }
}
</style>
