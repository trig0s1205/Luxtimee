<script setup lang="ts">
import type {
  PosCashClosingDto,
  PosCashClosingPreviewDto,
  PosCashClosingsPageDto,
  PosCashSaleLineDto,
} from '@luxtime/shared';
import { cashClosingNoteValid, expectedDrawerCash } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['admin'] });
useSeoMeta({ title: 'Cierre de caja — LUXTIMEE Admin' });

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { confirm } = useConfirm();

const date = ref(bogotaToday());
const openingCash = ref(0);
const countedCash = ref(0);
const notes = ref('');
const saving = ref(false);
const loading = ref(false);
const preview = ref<PosCashClosingPreviewDto | null>(null);
const history = ref<PosCashClosingDto[]>([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyLimit = 10;
const expandedId = ref<string | null>(null);
const from = ref('');
const to = ref('');
const showOutflow = ref(false);
const outflowName = ref('');
const outflowAmount = ref<number | null>(null);
const outflowNotes = ref('');
const savingOutflow = ref(false);

const isAdmin = computed(() => auth.isStaff);
const liveExpected = computed(() =>
  expectedDrawerCash(
    Number(openingCash.value) || 0,
    preview.value?.totalCash ?? 0,
    preview.value?.cashOutTotal ?? 0,
  ),
);
const expectedCash = computed(() =>
  preview.value?.alreadyClosed && preview.value.closing
    ? preview.value.closing.expectedCash
    : liveExpected.value,
);
const difference = computed(() =>
  preview.value?.alreadyClosed && preview.value.closing
    ? preview.value.closing.difference
    : (Number(countedCash.value) || 0) - expectedCash.value,
);
const noteTooShort = computed(
  () =>
    !preview.value?.alreadyClosed &&
    !cashClosingNoteValid(difference.value, notes.value),
);
const diffClass = computed(() => {
  if (difference.value === 0) return 'is-ok';
  if (difference.value > 0) return 'is-over';
  return 'is-short';
});

async function loadPreview() {
  loading.value = true;
  try {
    preview.value = await api.get<PosCashClosingPreviewDto>(
      '/pos/cash-closing/preview',
      { date: date.value },
    );
    if (preview.value.alreadyClosed && preview.value.closing) {
      openingCash.value = preview.value.closing.openingCash;
      countedCash.value = preview.value.closing.countedCash;
      notes.value = preview.value.closing.notes ?? '';
    } else if (!preview.value.alreadyClosed) {
      openingCash.value = 0;
      countedCash.value = 0;
      notes.value = '';
    }
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el preview.'));
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  try {
    const path = isAdmin.value ? '/pos/cash-closings' : '/pos/cash-closings/mine';
    const page = await api.get<PosCashClosingsPageDto>(path, {
      from: isAdmin.value ? from.value || undefined : undefined,
      to: isAdmin.value ? to.value || undefined : undefined,
      page: historyPage.value,
      limit: historyLimit,
    });
    history.value = page.items;
    historyTotal.value = page.total;
  } catch (err: unknown) {
    history.value = [];
    historyTotal.value = 0;
    if (isAdmin.value) {
      toast.error(extractApiErrorMessage(err, 'No se pudieron cargar los cierres.'));
    }
  }
}

async function registerOutflow() {
  const name = outflowName.value.trim();
  const amount = Number(outflowAmount.value);
  if (!name || !Number.isInteger(amount) || amount <= 0) {
    toast.warning('Indica concepto y un monto mayor a 0.');
    return;
  }
  savingOutflow.value = true;
  try {
    await api.post('/pos/cash-outs', {
      date: date.value,
      name,
      amount,
      notes: outflowNotes.value.trim() || undefined,
    });
    outflowName.value = '';
    outflowAmount.value = null;
    outflowNotes.value = '';
    showOutflow.value = false;
    toast.success('Salida registrada en Gastos.');
    await loadPreview();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la salida.'));
  } finally {
    savingOutflow.value = false;
  }
}

async function submitClosing() {
  if (preview.value?.alreadyClosed) {
    toast.warning('Ya registraste el cierre de este día.');
    return;
  }
  const ok = await confirm({
    title: 'Cerrar caja',
    message: `¿Confirmar cierre con diferencia ${formatCop(difference.value)}?`,
    confirmLabel: 'Cerrar caja',
  });
  if (!ok) return;
  saving.value = true;
  try {
    await api.post<PosCashClosingDto>('/pos/cash-closing', {
      date: date.value,
      openingCash: Number(openingCash.value) || 0,
      countedCash: Number(countedCash.value) || 0,
      notes: notes.value.trim() || undefined,
    });
    toast.success('Cierre de caja guardado.');
    await Promise.all([loadPreview(), loadHistory()]);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar el cierre.'));
  } finally {
    saving.value = false;
  }
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const historyPages = computed(() => Math.max(1, Math.ceil(historyTotal.value / historyLimit)));

const saleGroups = computed(() => {
  const cash = preview.value?.salesByMethod.cash ?? [];
  const transfer = preview.value?.salesByMethod.transfer ?? [];
  const card = preview.value?.salesByMethod.card ?? [];
  const pack = (key: string, label: string, rows: PosCashSaleLineDto[]) => ({
    key,
    label,
    rows,
    subtotal: rows.reduce((sum, row) => sum + row.portion, 0),
  });
  return [
    pack('cash', 'Efectivo', cash),
    pack('transfer', 'Transferencias', transfer),
    pack('card', 'Datáfono', card),
  ];
});

function saleRef(sale: PosCashSaleLineDto) {
  return sale.receiptNumber || sale.readableId;
}

const config = useRuntimeConfig();

function downloadClosingPdf(id: string) {
  window.open(`${config.public.apiBaseUrl}/pos/cash-closings/${id}/pdf`, '_blank');
}

onMounted(async () => {
  await Promise.all([loadPreview(), loadHistory()]);
});
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader label="Punto de venta" title="Cierre de caja" />
    <p class="admin-record-muted">
      Las ventas anuladas después del cierre no modifican el cierre guardado.
    </p>

    <div class="admin-orders-search pos-caja-toolbar">
      <label class="pos-caja-field">
        <span>Fecha</span>
        <input
          v-model="date"
          type="date"
          class="admin-input"
          @change="loadPreview"
        >
      </label>
      <button
        type="button"
        class="admin-record-btn admin-record-btn--ghost"
        :disabled="loading"
        @click="loadPreview"
      >
        Actualizar
      </button>
    </div>

    <div class="admin-expenses-totals pos-caja-totals">
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Efectivo</p>
        <p class="admin-record-amount">{{ formatCop(preview?.totalCash ?? 0) }}</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Transferencias</p>
        <p class="admin-record-amount">{{ formatCop(preview?.totalTransfer ?? 0) }}</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Datáfono</p>
        <p class="admin-record-amount">{{ formatCop(preview?.totalCard ?? 0) }}</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Total ventas</p>
        <p class="admin-record-amount">{{ formatCop(preview?.totalSales ?? 0) }}</p>
        <p class="admin-record-muted">{{ preview?.salesCount ?? 0 }} ventas</p>
      </article>
      <article class="admin-record-card p-4">
        <p class="admin-record-muted">Salidas</p>
        <p class="admin-record-amount">{{ formatCop(preview?.cashOutTotal ?? 0) }}</p>
      </article>
    </div>

    <details class="admin-record-card caja-fold">
      <summary>Ver ventas del día</summary>
      <div class="caja-fold-body">
        <details
          v-for="group in saleGroups"
          :key="group.key"
          class="caja-method"
        >
          <summary>
            {{ group.label }}
            <span class="admin-record-muted">{{ group.rows.length }} · {{ formatCop(group.subtotal) }}</span>
          </summary>
          <article v-for="sale in group.rows" :key="group.key + sale.orderId" class="caja-sale">
            <div class="caja-sale-main">
              <img
                v-if="sale.watches[0]?.imageUrl"
                :src="sale.watches[0].imageUrl"
                alt=""
                class="caja-thumb"
              >
              <div>
                <p class="admin-record-title">{{ formatWhen(sale.paidAt) }} · {{ saleRef(sale) }}</p>
                <p class="admin-record-subtitle">{{ sale.customerName }}</p>
                <p class="admin-record-muted">
                  {{ sale.watches.map((watch) => watch.name).join(', ') || 'Sin reloj' }}
                </p>
              </div>
            </div>
            <p class="admin-record-amount">{{ formatCop(sale.portion) }}</p>
          </article>
          <p v-if="!group.rows.length" class="admin-record-empty">Sin ventas.</p>
        </details>
        <section v-if="preview?.voidedSales.length" class="caja-voided">
          <h3 class="admin-record-title">Anuladas (no cuentan)</h3>
          <article v-for="sale in preview.voidedSales" :key="'void-' + sale.orderId" class="caja-sale">
            <div>
              <p class="admin-record-title">{{ formatWhen(sale.paidAt) }} · {{ saleRef(sale) }}</p>
              <p class="admin-record-subtitle">{{ sale.customerName }}</p>
              <p class="admin-record-muted">{{ sale.watches.map((watch) => watch.name).join(', ') }}</p>
            </div>
            <p class="admin-record-amount">{{ formatCop(sale.total) }}</p>
          </article>
        </section>
      </div>
    </details>

    <section class="admin-records-list">
      <div class="caja-out-head">
        <h2 class="admin-record-title">Salidas de caja del día</h2>
        <button
          type="button"
          class="admin-record-btn admin-record-btn--ghost"
          @click="showOutflow = !showOutflow"
        >
          + Registrar salida
        </button>
      </div>
      <form v-if="showOutflow" class="admin-record-card p-4 space-y-3" @submit.prevent="registerOutflow">
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Concepto</span>
          <input v-model="outflowName" maxlength="120" required class="admin-input">
        </label>
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Monto</span>
          <input v-model.number="outflowAmount" type="number" min="1" step="1" required class="admin-input">
        </label>
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Notas</span>
          <textarea v-model="outflowNotes" rows="2" maxlength="500" class="admin-record-textarea" />
        </label>
        <button type="submit" class="admin-record-btn admin-record-btn--primary" :disabled="savingOutflow">
          {{ savingOutflow ? 'Guardando…' : 'Guardar salida' }}
        </button>
      </form>
      <article v-for="row in preview?.cashOuts ?? []" :key="row.id" class="admin-record-card">
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ row.name }}</span>
              <span v-if="row.description" class="admin-record-subtitle">{{ row.description }}</span>
            </div>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(row.amount) }}</span>
            <span class="admin-record-date">{{ formatWhen(row.createdAt) }}</span>
            <span class="admin-record-muted">{{ row.createdByName || '—' }}</span>
          </div>
        </div>
      </article>
      <p v-if="!(preview?.cashOuts.length)" class="admin-record-empty">Sin salidas en efectivo este día.</p>
    </section>

    <form class="admin-record-card p-5 space-y-4" @submit.prevent="submitClosing">
      <h2 class="admin-record-title">
        {{ preview?.alreadyClosed ? 'Cierre ya registrado' : 'Registrar cierre' }}
      </h2>
      <div class="grid gap-4 md:grid-cols-3">
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Apertura (efectivo)</span>
          <input
            v-model.number="openingCash"
            type="number"
            min="0"
            step="1"
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
            :disabled="preview?.alreadyClosed"
          >
        </label>
        <label class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Contado en caja</span>
          <input
            v-model.number="countedCash"
            type="number"
            min="0"
            step="1"
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
            :disabled="preview?.alreadyClosed"
          >
        </label>
        <div class="block space-y-2">
          <span class="text-xs uppercase tracking-widest text-lux-white-dim">Esperado / diferencia</span>
          <p class="admin-record-amount">{{ formatCop(expectedCash) }}</p>
          <p class="caja-diff" :class="diffClass">Dif. {{ formatCop(difference) }}</p>
        </div>
      </div>
      <label class="block space-y-2">
        <span class="text-xs uppercase tracking-widest text-lux-white-dim">Notas</span>
        <textarea
          v-model="notes"
          rows="2"
          maxlength="500"
          class="admin-record-textarea"
          :disabled="preview?.alreadyClosed"
          :required="noteTooShort"
        />
        <p v-if="noteTooShort" class="caja-hint">Explica por qué sobra o falta dinero</p>
      </label>
      <button
        type="submit"
        class="admin-record-btn admin-record-btn--primary"
        :disabled="saving || preview?.alreadyClosed || noteTooShort"
      >
        {{
          preview?.alreadyClosed
            ? 'Ya cerrado'
            : saving
              ? 'Guardando…'
              : 'Cerrar caja'
        }}
      </button>
    </form>

    <section class="admin-records-list">
      <h2 class="admin-record-title">Historial</h2>
      <div v-if="isAdmin" class="pos-caja-toolbar">
        <label class="pos-caja-field">
          <span>Desde</span>
          <input v-model="from" type="date" class="admin-input">
        </label>
        <label class="pos-caja-field">
          <span>Hasta</span>
          <input v-model="to" type="date" class="admin-input">
        </label>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="historyPage = 1; loadHistory()">
          Filtrar
        </button>
      </div>
      <article v-for="row in history" :key="row.id" class="admin-record-card">
        <button type="button" class="caja-history-row" @click="expandedId = expandedId === row.id ? null : row.id">
          <span>{{ row.businessDate }}</span>
          <span>{{ row.userName || row.userId }}</span>
          <span>Apertura {{ formatCop(row.openingCash) }}</span>
          <span>Efec. {{ formatCop(row.totalCash) }}</span>
          <span>Transf. {{ formatCop(row.totalTransfer) }}</span>
          <span>Data. {{ formatCop(row.totalCard) }}</span>
          <span>Salidas {{ formatCop(row.cashOutTotal) }}</span>
          <span>Esp. {{ formatCop(row.expectedCash) }}</span>
          <span>Contado {{ formatCop(row.countedCash) }}</span>
          <span :class="row.difference < 0 ? 'is-short' : 'is-ok'">Dif. {{ formatCop(row.difference) }}</span>
        </button>
        <div v-if="expandedId === row.id" class="caja-history-detail">
          <p class="admin-record-muted">{{ row.salesCount }} ventas · Otros {{ formatCop(row.totalOther) }} · Total {{ formatCop(row.totalSales) }}</p>
          <p>{{ row.notes || 'Sin notas' }}</p>
          <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="downloadClosingPdf(row.id)">
            Descargar PDF
          </button>
        </div>
      </article>
      <p v-if="!history.length" class="admin-record-empty">Todavía no hay cierres guardados.</p>
      <nav v-if="historyPages > 1" class="admin-records-pagination" aria-label="Paginación de cierres">
        <button type="button" class="admin-records-page-btn" :disabled="historyPage <= 1" @click="historyPage--; loadHistory()">
          Anterior
        </button>
        <span class="admin-records-page-info">Página {{ historyPage }} de {{ historyPages }}</span>
        <button type="button" class="admin-records-page-btn" :disabled="historyPage >= historyPages" @click="historyPage++; loadHistory()">
          Siguiente
        </button>
      </nav>
    </section>
  </div>
</template>

<style scoped>
.pos-caja-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}

.pos-caja-field {
  display: grid;
  gap: 0.35rem;
}

.pos-caja-field span {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #9ca3af);
}

.pos-caja-field .admin-input {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 700px) {
  .pos-caja-toolbar,
  .pos-caja-field,
  .pos-caja-totals,
  .admin-record-summary {
    min-width: 0;
    max-width: 100%;
  }

  .pos-caja-field {
    flex: 1 1 100%;
  }

  .admin-record-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pos-caja-totals {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 1rem;
}

@media (min-width: 900px) {
  .pos-caja-totals {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.caja-fold,
.caja-method {
  margin-bottom: 0.75rem;
}

.caja-fold summary,
.caja-method summary,
.caja-history-row {
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0.85rem 1rem;
}

.caja-fold-body,
.caja-history-detail {
  padding: 0 1rem 1rem;
}

.caja-sale {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid rgba(200, 169, 110, 0.15);
}

.caja-sale-main {
  display: flex;
  gap: 0.6rem;
  min-width: 0;
}

.caja-thumb {
  width: 42px;
  height: 42px;
  object-fit: cover;
  border-radius: 4px;
  flex: none;
}

.caja-voided {
  opacity: 0.55;
  margin-top: 0.75rem;
}

.caja-out-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.caja-hint {
  margin: 0;
  color: #b91c1c;
  font-size: 0.8rem;
}

.caja-history-row .is-ok {
  color: #15803d;
  font-weight: 700;
}

.caja-history-row .is-short {
  color: #b91c1c;
  font-weight: 700;
}

.caja-diff {
  margin: 0;
  font-weight: 700;
}

.caja-diff.is-ok {
  color: #15803d;
}

.caja-diff.is-over {
  color: #b45309;
}

.caja-diff.is-short {
  color: #b91c1c;
}
</style>
