<script setup lang="ts">
import type {
  PosCashClosingDto,
  PosCashClosingPreviewDto,
} from '@luxtime/shared';
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
const mine = ref<PosCashClosingDto[]>([]);
const allClosings = ref<PosCashClosingDto[]>([]);
const from = ref('');
const to = ref('');

const isAdmin = computed(() => auth.isStaff);
const expectedCash = computed(
  () => (Number(openingCash.value) || 0) + (preview.value?.totalCash ?? 0),
);
const difference = computed(
  () => (Number(countedCash.value) || 0) - expectedCash.value,
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

async function loadMine() {
  try {
    mine.value = await api.get<PosCashClosingDto[]>('/pos/cash-closings/mine');
  } catch {
    mine.value = [];
  }
}

async function loadAll() {
  if (!isAdmin.value) return;
  try {
    allClosings.value = await api.get<PosCashClosingDto[]>('/pos/cash-closings', {
      from: from.value || undefined,
      to: to.value || undefined,
    });
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar los cierres.'));
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
    await Promise.all([loadPreview(), loadMine(), loadAll()]);
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

onMounted(async () => {
  await Promise.all([loadPreview(), loadMine(), loadAll()]);
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
    </div>

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
        />
      </label>
      <button
        type="submit"
        class="admin-record-btn admin-record-btn--primary"
        :disabled="saving || preview?.alreadyClosed"
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
      <h2 class="admin-record-title">Ventas del día</h2>
      <article
        v-for="sale in preview?.sales ?? []"
        :key="sale.readableId + sale.paidAt"
        class="admin-record-card"
      >
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ sale.readableId }}</span>
              <span class="admin-record-subtitle">{{ sale.customerName }}</span>
            </div>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(sale.total) }}</span>
            <span class="admin-record-date">{{ formatWhen(sale.paidAt) }}</span>
            <span class="admin-record-muted">{{ sale.methods.join(' · ') }}</span>
          </div>
        </div>
      </article>
      <p v-if="!(preview?.sales.length)" class="admin-record-empty">
        Sin ventas registradas para esta fecha.
      </p>
    </section>

    <section class="admin-records-list">
      <h2 class="admin-record-title">Mis últimos cierres</h2>
      <article v-for="row in mine" :key="row.id" class="admin-record-card">
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <span class="admin-record-title">{{ row.businessDate }}</span>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(row.totalSales) }}</span>
            <span class="admin-record-muted">Dif. {{ formatCop(row.difference) }}</span>
            <span class="admin-record-date">{{ formatWhen(row.createdAt) }}</span>
          </div>
        </div>
      </article>
    </section>

    <section v-if="isAdmin" class="admin-records-list">
      <h2 class="admin-record-title">Cierres (admin)</h2>
      <div class="pos-caja-toolbar">
        <label class="pos-caja-field">
          <span>Desde</span>
          <input v-model="from" type="date" class="admin-input">
        </label>
        <label class="pos-caja-field">
          <span>Hasta</span>
          <input v-model="to" type="date" class="admin-input">
        </label>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="loadAll">
          Filtrar
        </button>
      </div>
      <article v-for="row in allClosings" :key="row.id" class="admin-record-card">
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ row.businessDate }}</span>
              <span class="admin-record-subtitle">{{ row.userName || row.userId }}</span>
            </div>
          </div>
          <div class="admin-record-meta">
            <span class="admin-record-amount">{{ formatCop(row.totalSales) }}</span>
            <span class="admin-record-muted">Efectivo {{ formatCop(row.totalCash) }}</span>
            <span class="admin-record-muted">Dif. {{ formatCop(row.difference) }}</span>
          </div>
        </div>
      </article>
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

.pos-caja-totals {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 1rem;
}

@media (min-width: 900px) {
  .pos-caja-totals {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
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
