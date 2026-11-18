<script setup lang="ts">
import {
  WARRANTY_CLAIM_STATUS_LABELS,
  type WarrantyClaimStatus,
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

type ClaimDetail = ClaimListItem & {
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

async function transitionClaim(next: WarrantyClaimStatus) {
  if (!claimDetail.value) return;
  updatingStatus.value = true;
  try {
    const detail = await api.patch<ClaimDetail>(
      `/warranty-claims/${claimDetail.value.id}/status`,
      { status: next },
    );
    claimDetail.value = detail;
    claimNotesDraft.value = detail.notes ?? '';
    await loadClaims();
    toast.success(`Estado: ${WARRANTY_CLAIM_STATUS_LABELS[next]}`);
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
  </div>
</template>

<style scoped>
.admin-comprobantes-tabs {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
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
</style>
