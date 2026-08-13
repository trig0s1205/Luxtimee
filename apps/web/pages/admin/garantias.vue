<script setup lang="ts">
import type { WarrantyHistoriesListDto, WarrantyHistoryDto } from '@luxtime/shared';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const config = useRuntimeConfig();

const expandedIds = ref<Set<string>>(new Set());
const exporting = ref<'pdf' | 'excel' | null>(null);

const emptyList: WarrantyHistoriesListDto = {
  items: [],
  total: 0,
  page: 1,
  limit: 50,
  period: 'day',
  periodLabel: 'Hoy',
};

const { data, pending, refresh } = useAdminCachedData(
  'warranty-histories',
  () => api.get<WarrantyHistoriesListDto>('/warranty-histories').catch(() => emptyList),
);

const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const canExport = computed(() => total.value > 0);

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

async function exportReport(type: 'pdf' | 'excel') {
  if (!canExport.value) return;
  exporting.value = type;
  try {
    const endpoint = type === 'pdf' ? 'export/pdf' : 'export/excel';
    window.open(`${config.public.apiBaseUrl}/warranty-histories/${endpoint}`, '_blank');
    window.setTimeout(async () => {
      await refresh();
      exporting.value = null;
    }, 1500);
  } catch {
    exporting.value = null;
  }
}

useSeoMeta({ title: 'Historias de garantías — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader
      label="Ventas"
      :title="`Garantías de hoy (${total})`"
      refreshable
      :refreshing="pending"
      @refresh="refresh()"
    />
    <p class="admin-records-hint">
      Solo se muestran las garantías registradas hoy. Al exportar el reporte del día, se archivan y se limpian de la plataforma.
    </p>

    <section class="admin-record-export">
      <h3>Reporte del día</h3>
      <p>Descarga el reporte completo en PDF o Excel. Solo disponible si hay garantías registradas hoy.</p>
      <div class="admin-record-actions">
        <button
          type="button"
          class="admin-record-btn admin-record-btn--primary"
          :disabled="!canExport || exporting === 'pdf'"
          @click="exportReport('pdf')"
        >
          {{ exporting === 'pdf' ? 'Generando...' : 'Exportar PDF' }}
        </button>
        <button
          type="button"
          class="admin-record-btn"
          :disabled="!canExport || exporting === 'excel'"
          @click="exportReport('excel')"
        >
          {{ exporting === 'excel' ? 'Generando...' : 'Exportar Excel' }}
        </button>
      </div>
    </section>

    <div v-if="pending && !items.length" class="admin-record-empty">Cargando garantías...</div>

    <div v-else class="admin-records-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="admin-record-card"
        :class="{ 'admin-record-card--open': isExpanded(item.id) }"
      >
        <button type="button" class="admin-record-summary" :aria-expanded="isExpanded(item.id)" @click="toggleExpanded(item.id)">
          <div class="admin-record-summary-main">
            <svg class="admin-record-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
            <div>
              <span class="admin-record-title">{{ item.productSku }}</span>
              <span class="admin-record-subtitle">{{ item.customerName }}</span>
            </div>
          </div>

          <div class="admin-record-meta">
            <span class="admin-record-date">{{ formatDate(item.serviceDate) }}</span>
          </div>

          <div class="admin-record-summary-actions" @click.stop>
            <AdminTagMenu :label="replacementLabel(item)">
              <span class="admin-record-chip">{{ replacementLabel(item) }}</span>
            </AdminTagMenu>
          </div>
        </button>

        <div v-show="isExpanded(item.id)" class="admin-record-details">
          <div class="admin-record-details-inner">
            <AdminAccordionSection title="Cliente" :subtitle="item.customerName">
              <p>{{ item.customerName }}</p>
              <p class="admin-record-muted">{{ item.customerPhone || 'Sin teléfono' }}</p>
              <p class="admin-record-muted">{{ item.customerAddress }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection title="Producto" :subtitle="item.productSku">
              <p>{{ item.productSku }}</p>
              <p class="admin-record-muted">{{ item.productName }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection title="Fechas" subtitle="Venta y servicio">
              <p>Venta: {{ formatDate(item.saleDate) }}</p>
              <p class="admin-record-muted">Garantía: {{ formatDate(item.serviceDate) }}</p>
            </AdminAccordionSection>

            <AdminAccordionSection title="Reclamo" subtitle="Daño y reemplazo">
              <p><strong>Daño:</strong> {{ item.damageDescription }}</p>
              <p class="admin-record-muted"><strong>Reemplazo:</strong> {{ replacementLabel(item) }}</p>
              <p v-if="item.replacementNotes" class="admin-record-muted"><strong>Notas:</strong> {{ item.replacementNotes }}</p>
            </AdminAccordionSection>
          </div>
        </div>
      </article>

      <p v-if="!items.length" class="admin-record-empty">No hay garantías registradas hoy.</p>
    </div>
  </div>
</template>




