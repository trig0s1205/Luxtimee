<script setup lang="ts">
import {
  WARRANTY_CLAIM_STATUS_LABELS,
  WarrantyClaimStatus,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';
import {
  createScanDetector,
  looksLikeSku,
  normalizeScannedCode,
} from '~/utils/barcode-scan';

definePageMeta({ middleware: ['admin'] });
useSeoMeta({ title: 'Comprobantes y garantías — LUXTIMEE Admin' });

const api = useApi();
const toast = useToast();
const config = useRuntimeConfig();
const { confirm } = useConfirm();

type Tab = 'consultar' | 'reclamos';
const tab = ref<Tab>('consultar');

type SearchItem = {
  id: string;
  productName: string;
  sku: string;
  limitedEditionNumber: string | null;
  warrantyStatus: 'VIGENTE' | 'VENCIDA' | 'SIN_GARANTIA';
  daysLeft: number | null;
  warrantyEndsAt: string | null;
  openClaimsCount: number;
};

type SearchReceipt = {
  id: string;
  number: string;
  channel: string;
  saleDate: string;
  voidedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  total: number;
  items: SearchItem[];
};

type ClaimListItem = {
  id: string;
  status: WarrantyClaimStatus;
  reportedIssue: string;
  notes: string | null;
  outOfWarranty: boolean;
  createdAt: string;
  productName: string;
  sku: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string | null;
};

type ReplacementWatch = {
  id: string;
  sku: string;
  brand: string;
  model: string;
  stock: number;
  price: number;
};

type ClaimDetail = ClaimListItem & {
  replacementSku: string | null;
  replacementWatch: ReplacementWatch | null;
  allowedTransitions: WarrantyClaimStatus[];
  events: Array<{
    id: string;
    fromStatus: WarrantyClaimStatus | null;
    toStatus: WarrantyClaimStatus;
    note: string | null;
    createdAt: string;
    createdByName: string;
  }>;
};

type ReceiptListItem = {
  id: string;
  number: string;
  saleDate: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  status: 'EMITIDO' | 'ANULADO';
  orderId: string | null;
  orderReadableId: string;
};

type ReceiptListStatus = '' | 'EMITIDO' | 'ANULADO';

const listItems = ref<ReceiptListItem[]>([]);
const listTotal = ref(0);
const listPage = ref(1);
const listPageSize = 20;
const listPending = ref(false);
const listQuery = ref('');
const listStatus = ref<ReceiptListStatus>('');
const listFrom = ref('');
const listTo = ref('');
let listTimer: ReturnType<typeof setTimeout> | null = null;

const listTotalPages = computed(() =>
  Math.max(1, Math.ceil(listTotal.value / listPageSize)),
);

const searchInput = ref('');
const searchTerm = ref('');
const searching = ref(false);
const results = ref<SearchReceipt[]>([]);
const searchTotal = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const scanDetector = createScanDetector();

const claimStatus = ref<'' | WarrantyClaimStatus>('');
const claims = ref<ClaimListItem[]>([]);
const claimsPending = ref(false);
const expandedClaimId = ref<string | null>(null);
const claimDetail = ref<ClaimDetail | null>(null);
const claimNotesDraft = ref('');
const savingNotes = ref(false);
const updatingStatus = ref(false);

const replaceOpen = ref(false);
const replacementSku = ref('');
const replacementNote = ref('');

const claimFormItemId = ref<string | null>(null);
const claimIssue = ref('');
const claimNotes = ref('');
const claimSaving = ref(false);

const CLAIM_STATUSES = Object.keys(
  WARRANTY_CLAIM_STATUS_LABELS,
) as WarrantyClaimStatus[];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

async function loadReceipts() {
  listPending.value = true;
  try {
    const data = await api.get<{
      items: ReceiptListItem[];
      total: number;
      page: number;
    }>('/receipts', {
      q: listQuery.value.trim() || undefined,
      status: listStatus.value || undefined,
      from: listFrom.value || undefined,
      to: listTo.value || undefined,
      page: listPage.value,
      pageSize: listPageSize,
    });
    listItems.value = data.items;
    listTotal.value = data.total;
    listPage.value = data.page;
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar los comprobantes.'));
  } finally {
    listPending.value = false;
  }
}

function onListQueryInput() {
  if (listTimer) clearTimeout(listTimer);
  listTimer = setTimeout(() => {
    listPage.value = 1;
    void loadReceipts();
  }, 300);
}

function onListFilterChange() {
  listPage.value = 1;
  void loadReceipts();
}

function goToListPage(next: number) {
  listPage.value = next;
  void loadReceipts();
}

onMounted(() => {
  void loadReceipts();
});

function warrantyTone(status: SearchItem['warrantyStatus']) {
  if (status === 'VIGENTE') return 'pagado' as const;
  if (status === 'VENCIDA') return 'cancelado' as const;
  return 'pendiente' as const;
}

function warrantyLabel(item: SearchItem) {
  if (item.warrantyStatus === 'VIGENTE') {
    const days = item.daysLeft ?? 0;
    return `Vigente · quedan ${days} día${days === 1 ? '' : 's'}`;
  }
  if (item.warrantyStatus === 'VENCIDA') {
    const ends = item.warrantyEndsAt ? formatDate(item.warrantyEndsAt) : '';
    return ends ? `Vencida · venció el ${ends}` : 'Vencida';
  }
  return 'Sin garantía';
}

function claimTone(status: WarrantyClaimStatus) {
  switch (status) {
    case 'RECIBIDO':
      return 'pendiente' as const;
    case 'EN_REVISION':
      return 'enviado' as const;
    case 'REPARADO':
    case 'REEMPLAZADO':
      return 'pagado' as const;
    case 'RECHAZADO':
      return 'cancelado' as const;
    case 'ENTREGADO':
      return 'entregado' as const;
    default:
      return 'detal' as const;
  }
}

function downloadReceipt(id: string) {
  window.open(`${config.public.apiBaseUrl}/receipts/${id}/pdf`, '_blank');
}

async function runSearch(term: string) {
  const q = term.trim();
  searchTerm.value = q;
  if (!q) {
    results.value = [];
    searchTotal.value = 0;
    return;
  }
  searching.value = true;
  try {
    const data = await api.get<{ items: SearchReceipt[]; total: number }>(
      '/receipts/search',
      { q, page: 1, limit: 30 },
    );
    results.value = data.items;
    searchTotal.value = data.total;
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo buscar.'));
  } finally {
    searching.value = false;
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch(searchInput.value);
  }, 300);
}

function onSearchKeydown(event: KeyboardEvent) {
  const result = scanDetector.push(event.key, event.timeStamp);
  if (!result) return;
  event.preventDefault();
  if (searchTimer) clearTimeout(searchTimer);
  const raw = result.type === 'scan' ? result.code : result.text;
  const code =
    result.type === 'scan' || looksLikeSku(raw)
      ? normalizeScannedCode(raw)
      : raw.trim();
  searchInput.value = code;
  void runSearch(code);
}

function openClaimForm(item: SearchItem) {
  claimFormItemId.value = item.id;
  claimIssue.value = '';
  claimNotes.value = '';
}

function closeClaimForm() {
  claimFormItemId.value = null;
  claimIssue.value = '';
  claimNotes.value = '';
}

async function submitClaim(item: SearchItem) {
  const issue = claimIssue.value.trim();
  if (issue.length < 10) {
    toast.warning('Describe el problema (mínimo 10 caracteres).');
    return;
  }
  if (item.warrantyStatus === 'VENCIDA' || item.warrantyStatus === 'SIN_GARANTIA') {
    const ok = await confirm({
      title: 'Garantía vencida o sin cobertura',
      message:
        'La garantía de este reloj está vencida. ¿Registrar el reclamo de todas formas?',
      confirmLabel: 'Registrar igual',
    });
    if (!ok) return;
  }
  claimSaving.value = true;
  try {
    await api.post('/warranty-claims', {
      receiptItemId: item.id,
      reportedIssue: issue,
      notes: claimNotes.value.trim() || undefined,
    });
    toast.success('Reclamo registrado.');
    closeClaimForm();
    await runSearch(searchTerm.value);
    if (tab.value === 'reclamos') await loadClaims();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar el reclamo.'));
  } finally {
    claimSaving.value = false;
  }
}

async function loadClaims() {
  claimsPending.value = true;
  try {
    const data = await api.get<{ items: ClaimListItem[] }>('/warranty-claims', {
      status: claimStatus.value || undefined,
      page: 1,
      limit: 50,
    });
    claims.value = data.items;
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar los reclamos.'));
  } finally {
    claimsPending.value = false;
  }
}

async function toggleClaim(id: string) {
  if (expandedClaimId.value === id) {
    expandedClaimId.value = null;
    claimDetail.value = null;
    return;
  }
  expandedClaimId.value = id;
  try {
    const detail = await api.get<ClaimDetail>(`/warranty-claims/${id}`);
    claimDetail.value = detail;
    claimNotesDraft.value = detail.notes ?? '';
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo cargar el reclamo.'));
    expandedClaimId.value = null;
  }
}

async function saveClaimNotes() {
  if (!claimDetail.value) return;
  savingNotes.value = true;
  try {
    const detail = await api.patch<ClaimDetail>(
      `/warranty-claims/${claimDetail.value.id}/notes`,
      { notes: claimNotesDraft.value },
    );
    claimDetail.value = detail;
    toast.success('Notas guardadas.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron guardar las notas.'));
  } finally {
    savingNotes.value = false;
  }
}

function closeReplace() {
  if (updatingStatus.value) return;
  replaceOpen.value = false;
}

function transitionClaim(next: WarrantyClaimStatus) {
  if (!claimDetail.value) return;
  if (next === WarrantyClaimStatus.REEMPLAZADO) {
    replacementSku.value = '';
    replacementNote.value = '';
    replaceOpen.value = true;
    return;
  }
  void sendStatus({ status: next });
}

function confirmReplace() {
  if (!replacementSku.value.trim()) {
    toast.warning('Selecciona el reloj de reemplazo.');
    return;
  }
  void sendStatus({
    status: WarrantyClaimStatus.REEMPLAZADO,
    replacementSku: replacementSku.value.trim(),
    note: replacementNote.value.trim() || undefined,
  });
}

async function sendStatus(body: {
  status: WarrantyClaimStatus;
  replacementSku?: string;
  note?: string;
}) {
  if (!claimDetail.value) return;
  updatingStatus.value = true;
  try {
    const detail = await api.patch<ClaimDetail>(
      `/warranty-claims/${claimDetail.value.id}/status`,
      body,
    );
    claimDetail.value = detail;
    claimNotesDraft.value = detail.notes ?? '';
    replaceOpen.value = false;
    await loadClaims();
    toast.success(`Estado: ${WARRANTY_CLAIM_STATUS_LABELS[body.status]}`);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo actualizar el estado.'));
  } finally {
    updatingStatus.value = false;
  }
}

watch(tab, (value) => {
  if (value === 'reclamos') void loadClaims();
});

watch(claimStatus, () => {
  void loadClaims();
});
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader label="Local" title="Comprobantes y garantías" />

    <div class="admin-comprobantes-filters">
      <UiLuxInput
        v-model="listQuery"
        placeholder="N.º de comprobante, cliente o documento"
        @input="onListQueryInput"
      />
      <select v-model="listStatus" class="admin-filter-select" @change="onListFilterChange">
        <option value="">Todos</option>
        <option value="EMITIDO">Emitidos</option>
        <option value="ANULADO">Anulados</option>
      </select>
      <label class="admin-comprobantes-date">
        <span>Desde</span>
        <input v-model="listFrom" type="date" class="admin-input" @change="onListFilterChange">
      </label>
      <label class="admin-comprobantes-date">
        <span>Hasta</span>
        <input v-model="listTo" type="date" class="admin-input" @change="onListFilterChange">
      </label>
    </div>

    <p v-if="listPending && !listItems.length" class="admin-record-empty">Cargando comprobantes…</p>
    <p v-else-if="!listItems.length" class="admin-record-empty">No hay comprobantes con estos filtros.</p>
    <p v-else class="admin-record-muted">
      {{ listTotal }} comprobante{{ listTotal === 1 ? '' : 's' }}
    </p>

    <div class="admin-records-list">
      <article
        v-for="receipt in listItems"
        :key="receipt.id"
        class="admin-record-card"
      >
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ receipt.number }}</span>
              <span class="admin-record-subtitle">{{ formatDateTime(receipt.saleDate) }}</span>
            </div>
            <UiLuxBadge :tone="receipt.status === 'ANULADO' ? 'cancelado' : 'pagado'">
              {{ receipt.status === 'ANULADO' ? 'Anulado' : 'Emitido' }}
            </UiLuxBadge>
          </div>
          <div class="admin-record-meta">
            <span>{{ receipt.customerName }}</span>
            <span class="admin-record-amount">{{ formatCop(receipt.total) }}</span>
            <span class="admin-record-muted">{{ receipt.paymentMethod }}</span>
            <span class="admin-record-muted">Pedido {{ receipt.orderReadableId }}</span>
          </div>
          <div class="admin-record-summary-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              @click="downloadReceipt(receipt.id)"
            >
              Ver PDF
            </button>
          </div>
        </div>
      </article>
    </div>

    <nav v-if="listTotalPages > 1" class="admin-records-pagination" aria-label="Paginación de comprobantes">
      <button
        type="button"
        class="admin-records-page-btn"
        :disabled="listPage <= 1 || listPending"
        @click="goToListPage(listPage - 1)"
      >
        Anterior
      </button>
      <span class="admin-records-page-info">Página {{ listPage }} de {{ listTotalPages }}</span>
      <button
        type="button"
        class="admin-records-page-btn"
        :disabled="listPage >= listTotalPages || listPending"
        @click="goToListPage(listPage + 1)"
      >
        Siguiente
      </button>
    </nav>

    <div class="admin-comprobantes-tabs" role="tablist">
      <button
        type="button"
        class="admin-record-btn"
        :class="tab === 'consultar' ? 'admin-record-btn--primary' : 'admin-record-btn--ghost'"
        role="tab"
        :aria-selected="tab === 'consultar'"
        @click="tab = 'consultar'"
      >
        Consultar
      </button>
      <button
        type="button"
        class="admin-record-btn"
        :class="tab === 'reclamos' ? 'admin-record-btn--primary' : 'admin-record-btn--ghost'"
        role="tab"
        :aria-selected="tab === 'reclamos'"
        @click="tab = 'reclamos'"
      >
        Reclamos
      </button>
    </div>

    <section v-if="tab === 'consultar'" class="space-y-4">
      <div class="admin-orders-search">
        <UiLuxInput
          v-model="searchInput"
          placeholder="N.º de comprobante, cliente, teléfono, documento o SKU"
          @input="onSearchInput"
          @keydown="onSearchKeydown"
        />
      </div>
      <p v-if="searching" class="admin-record-muted">Buscando…</p>
      <p v-else-if="searchTerm && !results.length" class="admin-record-empty">
        Sin resultados para “{{ searchTerm }}”.
      </p>
      <p v-else-if="results.length" class="admin-record-muted">
        {{ searchTotal }} resultado{{ searchTotal === 1 ? '' : 's' }}
      </p>

      <article
        v-for="receipt in results"
        :key="receipt.id"
        class="admin-record-card p-4 space-y-3"
      >
        <div class="admin-record-summary">
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ receipt.number }}</span>
              <span class="admin-record-subtitle">
                {{ formatDate(receipt.saleDate) }} · {{ receipt.channel }}
              </span>
            </div>
            <UiLuxBadge v-if="receipt.voidedAt" tone="cancelado">Anulado</UiLuxBadge>
          </div>
          <div class="admin-record-meta">
            <span>{{ receipt.customerName }}</span>
            <span v-if="receipt.customerPhone" class="admin-record-muted">
              {{ receipt.customerPhone }}
            </span>
            <span class="admin-record-amount">{{ formatCop(receipt.total) }}</span>
          </div>
          <div class="admin-record-summary-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              @click="downloadReceipt(receipt.id)"
            >
              Descargar comprobante
            </button>
          </div>
        </div>

        <div
          v-for="item in receipt.items"
          :key="item.id"
          class="admin-comprobantes-item"
        >
          <div class="admin-comprobantes-item__main">
            <strong>{{ item.productName }}</strong>
            <span class="admin-record-muted">
              SKU {{ item.sku }}
              <template v-if="item.limitedEditionNumber">
                · Edición limitada N.º {{ item.limitedEditionNumber }}
              </template>
            </span>
            <UiLuxBadge :tone="warrantyTone(item.warrantyStatus)">
              {{ warrantyLabel(item) }}
            </UiLuxBadge>
            <span v-if="item.openClaimsCount" class="admin-record-muted">
              {{ item.openClaimsCount }} reclamo{{ item.openClaimsCount === 1 ? '' : 's' }} abierto{{ item.openClaimsCount === 1 ? '' : 's' }}
            </span>
          </div>
          <button
            v-if="!receipt.voidedAt"
            type="button"
            class="admin-record-btn admin-record-btn--primary"
            @click="openClaimForm(item)"
          >
            Registrar reclamo
          </button>

          <form
            v-if="claimFormItemId === item.id"
            class="admin-comprobantes-claim-form space-y-3"
            @submit.prevent="submitClaim(item)"
          >
            <label class="block space-y-2">
              <span class="text-xs uppercase tracking-widest text-lux-white-dim">
                Problema reportado
              </span>
              <textarea
                v-model="claimIssue"
                rows="3"
                maxlength="2000"
                required
                minlength="10"
                class="admin-record-textarea"
              />
            </label>
            <label class="block space-y-2">
              <span class="text-xs uppercase tracking-widest text-lux-white-dim">
                Notas (opcional)
              </span>
              <textarea
                v-model="claimNotes"
                rows="2"
                maxlength="2000"
                class="admin-record-textarea"
              />
            </label>
            <div class="admin-record-actions">
              <button
                type="submit"
                class="admin-record-btn admin-record-btn--primary"
                :disabled="claimSaving"
              >
                {{ claimSaving ? 'Guardando…' : 'Crear reclamo' }}
              </button>
              <button
                type="button"
                class="admin-record-btn admin-record-btn--ghost"
                @click="closeClaimForm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </article>
    </section>

    <section v-else class="space-y-4">
      <div class="admin-orders-search">
        <select v-model="claimStatus" class="admin-filter-select">
          <option value="">Todos los estados</option>
          <option
            v-for="status in CLAIM_STATUSES"
            :key="status"
            :value="status"
          >
            {{ WARRANTY_CLAIM_STATUS_LABELS[status] }}
          </option>
        </select>
      </div>

      <p v-if="claimsPending" class="admin-record-muted">Cargando reclamos…</p>
      <p v-else-if="!claims.length" class="admin-record-empty">No hay reclamos.</p>

      <article
        v-for="claim in claims"
        :key="claim.id"
        class="admin-record-card"
      >
        <button
          type="button"
          class="admin-record-summary admin-comprobantes-claim-toggle"
          @click="toggleClaim(claim.id)"
        >
          <div class="admin-record-summary-main">
            <div>
              <span class="admin-record-title">{{ claim.productName }}</span>
              <span class="admin-record-subtitle">
                {{ claim.customerName }}
                <template v-if="claim.customerPhone"> · {{ claim.customerPhone }}</template>
                · {{ formatDate(claim.createdAt) }}
              </span>
            </div>
            <UiLuxBadge :tone="claimTone(claim.status)">
              {{ WARRANTY_CLAIM_STATUS_LABELS[claim.status] }}
            </UiLuxBadge>
          </div>
        </button>

        <div
          v-if="expandedClaimId === claim.id && claimDetail"
          class="admin-comprobantes-claim-detail space-y-4 p-4"
        >
          <p><strong>Problema:</strong> {{ claimDetail.reportedIssue }}</p>
          <p class="admin-record-muted">
            Comprobante {{ claimDetail.receiptNumber }} · SKU {{ claimDetail.sku }}
          </p>
          <p v-if="claimDetail.replacementSku" class="admin-record-muted">
            Reemplazo:
            <template v-if="claimDetail.replacementWatch">
              {{ claimDetail.replacementWatch.brand }} {{ claimDetail.replacementWatch.model }} ·
            </template>
            SKU {{ claimDetail.replacementSku }}
          </p>

          <div class="space-y-2">
            <h3 class="admin-record-title">Historial</h3>
            <ul class="admin-comprobantes-events">
              <li v-for="event in claimDetail.events" :key="event.id">
                <span>{{ formatDate(event.createdAt) }}</span>
                ·
                <span>
                  {{ event.fromStatus ? WARRANTY_CLAIM_STATUS_LABELS[event.fromStatus] : '—' }}
                  → {{ WARRANTY_CLAIM_STATUS_LABELS[event.toStatus] }}
                </span>
                ·
                <span class="admin-record-muted">{{ event.createdByName }}</span>
                <span v-if="event.note"> — {{ event.note }}</span>
              </li>
            </ul>
          </div>

          <label class="block space-y-2">
            <span class="text-xs uppercase tracking-widest text-lux-white-dim">Notas</span>
            <textarea
              v-model="claimNotesDraft"
              rows="3"
              maxlength="2000"
              class="admin-record-textarea"
            />
          </label>
          <div class="admin-record-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              :disabled="savingNotes"
              @click="saveClaimNotes"
            >
              {{ savingNotes ? 'Guardando…' : 'Guardar notas' }}
            </button>
            <button
              v-for="next in claimDetail.allowedTransitions"
              :key="next"
              type="button"
              class="admin-record-btn admin-record-btn--primary"
              :disabled="updatingStatus"
              @click="transitionClaim(next)"
            >
              {{ WARRANTY_CLAIM_STATUS_LABELS[next] }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <div
        v-if="replaceOpen"
        class="admin-comprobantes-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Reemplazar reloj"
        @click.self="closeReplace"
      >
        <div class="admin-comprobantes-modal__card">
          <h3 class="admin-record-title">Reemplazar reloj</h3>
          <p class="admin-record-muted">
            Se descontará 1 unidad del reloj elegido.
          </p>
          <AdminWarrantyReplacementPicker
            v-model="replacementSku"
            :suggested-sku="claimDetail?.sku"
          />
          <label class="block space-y-2">
            <span class="text-xs uppercase tracking-widest text-lux-white-dim">
              Nota (opcional)
            </span>
            <textarea
              v-model="replacementNote"
              rows="2"
              maxlength="2000"
              class="admin-record-textarea"
            />
          </label>
          <div class="admin-record-actions">
            <button
              type="button"
              class="admin-record-btn admin-record-btn--primary"
              :disabled="updatingStatus || !replacementSku"
              @click="confirmReplace"
            >
              {{ updatingStatus ? 'Guardando…' : 'Confirmar reemplazo' }}
            </button>
            <button
              type="button"
              class="admin-record-btn admin-record-btn--ghost"
              :disabled="updatingStatus"
              @click="closeReplace"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.admin-comprobantes-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(9rem, 0.6fr) auto auto;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}

.admin-comprobantes-date {
  display: grid;
  gap: 0.35rem;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.admin-comprobantes-tabs {
  display: flex;
  gap: 0.75rem;
  margin: 1.5rem 0 1.25rem;
}

.admin-comprobantes-item {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

.admin-comprobantes-item__main {
  display: grid;
  gap: 0.35rem;
}

.admin-comprobantes-claim-form {
  padding: 0.75rem;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(0, 0, 0, 0.25);
}

.admin-comprobantes-claim-toggle {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.admin-comprobantes-events {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
}

.admin-comprobantes-modal {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.72);
}

.admin-comprobantes-modal__card {
  width: min(100%, 760px);
  display: grid;
  gap: 12px;
  padding: 20px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  background: #111111;
}

@media (max-width: 900px) {
  .admin-comprobantes-filters {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 767px) {
  .admin-comprobantes-filters {
    grid-template-columns: 1fr;
  }

  .admin-comprobantes-tabs,
  .admin-record-actions,
  .admin-record-summary,
  .admin-record-summary-actions,
  .admin-comprobantes-item,
  .admin-comprobantes-item__main {
    min-width: 0;
    max-width: 100%;
  }

  .admin-comprobantes-tabs {
    flex-wrap: wrap;
  }

  .admin-record-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-record-summary-actions {
    justify-content: flex-start;
  }

  .admin-comprobantes-item__main,
  .admin-comprobantes-item__main strong,
  .admin-record-subtitle {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .admin-record-actions .admin-record-btn,
  .admin-comprobantes-tabs .admin-record-btn,
  .admin-record-summary-actions .admin-record-btn {
    flex: 1 1 8rem;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    text-align: center;
  }
}
</style>
