<script setup lang="ts">
import type { WarrantyHistoriesListDto, WarrantyHistoryDto, WarrantyHistoryPeriod } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const config = useRuntimeConfig();

const PAGE_SIZE = 15;

const period = ref<WarrantyHistoryPeriod>('day');
const search = ref('');
const page = ref(1);
const expandedIds = ref<Set<string>>(new Set());

const periodOptions: { key: WarrantyHistoryPeriod; label: string }[] = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: '1 semana' },
  { key: 'month', label: '1 mes' },
  { key: 'all', label: 'Histórico' },
];

type ExportPeriod = 'day' | 'week' | 'month';
const exportPeriod = ref<ExportPeriod>('day');
const exportPeriods: { key: ExportPeriod; label: string }[] = [
  { key: 'day', label: 'Diario' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensual' },
];
const exporting = ref<'pdf' | 'excel' | null>(null);

function buildUrl() {
  const params = new URLSearchParams({
    period: period.value,
    page: String(page.value),
    limit: String(PAGE_SIZE),
  });
  if (search.value.trim()) params.set('search', search.value.trim());
  return `/warranty-histories?${params}`;
}

const emptyList: WarrantyHistoriesListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  period: 'day',
  periodLabel: 'Hoy',
};

const { data, pending } = await useAsyncData(
  'warranty-histories',
  () => api.get<WarrantyHistoriesListDto>(buildUrl()).catch(() => emptyList),
  { watch: [period, page, search] },
);

watch([period, search], () => {
  page.value = 1;
  expandedIds.value = new Set();
});

const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const periodLabel = computed(() => data.value?.periodLabel ?? 'Hoy');

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function replacementLabel(item: WarrantyHistoryDto) {
  if (item.replacementType === 'SAME_WATCH') return 'Mismo reloj';
  return `Otro (${item.replacementSku ?? '—'})`;
}

function isExpanded(id: string) {
  return expandedIds.value.has(id);
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
  expandedIds.value = new Set();
}

function exportReport(type: 'pdf' | 'excel') {
  exporting.value = type;
  const endpoint = type === 'pdf' ? 'export/pdf' : 'export/excel';
  window.open(`${config.public.apiBaseUrl}/warranty-histories/${endpoint}?period=${exportPeriod.value}`, '_blank');
  window.setTimeout(() => {
    exporting.value = null;
  }, 800);
}

useSeoMeta({ title: 'Historias de garantías — Luxtime Admin' });
</script>

<template>
  <div class="warranty-page">
    <UiSectionHeader label="Ventas" :title="`Historias de garantías (${total})`" />
    <p class="warranty-period-label">{{ periodLabel }}</p>

    <section class="warranty-export">
      <h3>Exportar historias</h3>
      <div class="warranty-export-controls">
        <div class="warranty-filters">
          <button
            v-for="item in exportPeriods"
            :key="item.key"
            type="button"
            class="warranty-filter-btn"
            :class="{ 'warranty-filter-btn--active': exportPeriod === item.key }"
            @click="exportPeriod = item.key"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="warranty-export-actions">
          <button type="button" class="warranty-export-btn" :disabled="exporting === 'pdf'" @click="exportReport('pdf')">
            {{ exporting === 'pdf' ? 'Generando...' : 'PDF' }}
          </button>
          <button type="button" class="warranty-export-btn" :disabled="exporting === 'excel'" @click="exportReport('excel')">
            {{ exporting === 'excel' ? 'Generando...' : 'Excel' }}
          </button>
        </div>
      </div>
    </section>

    <div class="warranty-toolbar">
      <div class="warranty-filters">
        <button
          v-for="item in periodOptions"
          :key="item.key"
          type="button"
          class="warranty-filter-btn"
          :class="{ 'warranty-filter-btn--active': period === item.key }"
          @click="period = item.key"
        >
          {{ item.label }}
        </button>
      </div>
      <UiLuxInput v-model="search" placeholder="Buscar por SKU, cliente o teléfono..." />
    </div>

    <div v-if="pending && !items.length" class="warranty-empty">Cargando historias...</div>

    <div v-else class="warranty-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="warranty-row"
        :class="{ 'warranty-row--open': isExpanded(item.id) }"
      >
        <button type="button" class="warranty-row-summary" :aria-expanded="isExpanded(item.id)" @click="toggleExpanded(item.id)">
          <svg class="warranty-row-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span class="warranty-row-sku">{{ item.productSku }}</span>
          <span class="warranty-row-customer">{{ item.customerName }}</span>
          <span class="warranty-row-date">{{ formatDate(item.serviceDate) }}</span>
        </button>

        <div v-show="isExpanded(item.id)" class="warranty-row-details">
          <div class="warranty-detail-grid">
            <div>
              <p class="warranty-detail-label">Cliente</p>
              <p>{{ item.customerName }}</p>
              <p class="warranty-muted">{{ item.customerPhone || 'Sin teléfono' }}</p>
              <p class="warranty-muted">{{ item.customerAddress }}</p>
            </div>
            <div>
              <p class="warranty-detail-label">Producto</p>
              <p>{{ item.productSku }}</p>
              <p class="warranty-muted">{{ item.productName }}</p>
            </div>
            <div>
              <p class="warranty-detail-label">Fechas</p>
              <p>Venta: {{ formatDate(item.saleDate) }}</p>
              <p class="warranty-muted">Garantía: {{ formatDate(item.serviceDate) }}</p>
            </div>
          </div>
          <div class="warranty-claim">
            <p><strong>Daño:</strong> {{ item.damageDescription }}</p>
            <p><strong>Reemplazo:</strong> {{ replacementLabel(item) }}</p>
            <p v-if="item.replacementNotes"><strong>Notas:</strong> {{ item.replacementNotes }}</p>
          </div>
        </div>
      </article>

      <p v-if="!items.length" class="warranty-empty">No hay garantías registradas en este periodo.</p>
    </div>

    <nav v-if="totalPages > 1" class="warranty-pagination" aria-label="Paginación">
      <button type="button" class="warranty-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">Anterior</button>
      <span class="warranty-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="warranty-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">Siguiente</button>
    </nav>
  </div>
</template>

<style scoped>
.warranty-page { max-width: 960px; }
.warranty-period-label { margin: -16px 0 20px; font-size: 12px; color: var(--lux-white-dim); }
.warranty-export { margin-bottom: 20px; padding: 16px; border: var(--border-hairline); background: rgba(255,255,255,0.02); }
.warranty-export h3 { margin: 0 0 12px; font-family: var(--lux-font-display); font-size: 18px; font-weight: 400; }
.warranty-export-controls { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; }
.warranty-export-actions { display: flex; gap: 8px; }
.warranty-toolbar { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.warranty-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.warranty-filter-btn, .warranty-export-btn, .warranty-page-btn {
  padding: 8px 14px; border: var(--border-hairline); background: transparent; color: var(--lux-white-dim);
  font-family: var(--lux-font-body); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
}
.warranty-filter-btn--active { color: var(--lux-gold); border-color: rgba(200,169,110,0.35); }
.warranty-list { display: flex; flex-direction: column; gap: 6px; }
.warranty-row { border: var(--border-hairline); background: rgba(255,255,255,0.02); }
.warranty-row-summary {
  display: grid; grid-template-columns: 16px 1fr 1fr auto; gap: 12px; align-items: center; width: 100%;
  padding: 12px 14px; border: none; background: transparent; color: var(--lux-white); font-size: 12px; text-align: left; cursor: pointer;
}
.warranty-row-chevron { color: var(--lux-white-dim); transition: transform 0.2s; }
.warranty-row--open .warranty-row-chevron { transform: rotate(180deg); }
.warranty-row-sku { font-family: var(--lux-font-display); color: var(--lux-gold); }
.warranty-row-customer { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.warranty-row-date { color: var(--lux-white-dim); font-size: 11px; }
.warranty-row-details { padding: 0 14px 14px 42px; border-top: var(--border-hairline); }
.warranty-detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; padding-top: 14px; font-size: 13px; }
.warranty-detail-label { margin: 0 0 6px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lux-white-dim); }
.warranty-muted { margin: 2px 0 0; color: var(--lux-white-dim); font-size: 12px; }
.warranty-claim { margin-top: 14px; padding-top: 12px; border-top: var(--border-hairline); font-size: 13px; }
.warranty-empty { color: var(--lux-white-dim); font-size: 13px; }
.warranty-pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.warranty-page-info { font-size: 12px; color: var(--lux-white-dim); }
.warranty-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
