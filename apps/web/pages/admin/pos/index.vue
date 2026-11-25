<script setup lang="ts">
import type {
  PosCustomerHintDto,
  PosSaleResultDto,
  PosWatchDto,
} from '@luxtime/shared';
import { authFetchHeaders } from '~/utils/auth-token';
import { extractApiErrorMessage } from '~/utils/api-error';
import { POS_SALE_TIMEOUT_MS } from '~/utils/api-timeout';
import { playBeep } from '~/utils/pos-feedback';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';
import {
  photoInitials,
  stockBadge,
  whatsappPhoneCo,
} from '~/utils/pos-catalog';
import { resolvePosDiscount } from '@luxtime/shared';
import { cartHasBlockedStock } from '~/utils/pos-cart-stock';

definePageMeta({ middleware: ['admin'] });
useSeoMeta({ title: 'POS — LUXTIMEE Admin' });

type CartLine = {
  watchId: string;
  sku: string;
  brandName: string;
  model: string;
  retailPrice: number;
  stock: number;
  imageUrl: string | null;
  limitedEditionNumber: string | null;
  warrantyMonths: number;
  quantity: number;
  discountMode: 'amount' | 'percent';
  discountValue: number;
};

type PaymentDraft = {
  id: string;
  method: 'EFECTIVO' | 'TRANSFERENCIA' | 'DATAFONO_BOLD';
  amount: number | null;
  amountTouched: boolean;
  cashReceived: number | null;
  reference: string;
  proofUrl: string;
  approvalCode: string;
  cardLast4: string;
  uploading?: boolean;
};

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const config = useRuntimeConfig();
const { confirm } = useConfirm();
const catalogRef = ref<{
  reload: () => Promise<void>;
  reloadSilent: () => Promise<void>;
  previewOpen: PosWatchDto | null;
} | null>(null);

const manualSearch = ref('');
const manualBusy = ref(false);
const manualHits = ref<PosWatchDto[]>([]);
const manualOpen = ref(false);
const manualHighlight = ref(-1);
const manualBroken = reactive<Record<string, boolean>>({});
const { resolve: resolveMedia } = useMediaUrl();
let manualTimer: ReturnType<typeof setTimeout> | null = null;

const cart = ref<CartLine[]>([]);
const customer = reactive({
  name: '',
  document: '',
  phone: '',
  email: '',
});
const customerHints = ref<PosCustomerHintDto[]>([]);
const note = ref('');
const globalDiscountMode = ref<'amount' | 'percent'>('amount');
const globalDiscountValue = ref(0);
const discountReason = ref('');
const payments = ref<PaymentDraft[]>([emptyPayment('EFECTIVO')]);
const selling = ref(false);
const successSale = ref<PosSaleResultDto | null>(null);
const successPhone = ref('');
const idempotencyKey = ref(crypto.randomUUID());
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const cartQtyById = computed(() => {
  const map: Record<string, number> = {};
  for (const line of cart.value) map[line.watchId] = line.quantity;
  return map;
});

const subtotal = computed(() =>
  cart.value.reduce((sum, line) => sum + line.retailPrice * line.quantity, 0),
);

function lineDiscountOf(line: CartLine) {
  const gross = line.retailPrice * line.quantity;
  const spec = line.discountMode === 'percent'
    ? { percent: Math.round(Number(line.discountValue) || 0) }
    : { amount: Math.round(Number(line.discountValue) || 0) };
  const resolved = resolvePosDiscount(gross, spec);
  return resolved.ok ? resolved.discount : 0;
}

const lineDiscountTotal = computed(() =>
  cart.value.reduce((sum, line) => sum + lineDiscountOf(line), 0),
);

const globalDiscount = computed(() => {
  const base = Math.max(0, subtotal.value - lineDiscountTotal.value);
  const spec = globalDiscountMode.value === 'percent'
    ? { percent: Math.round(Number(globalDiscountValue.value) || 0) }
    : { amount: Math.round(Number(globalDiscountValue.value) || 0) };
  const resolved = resolvePosDiscount(base, spec);
  return resolved.ok ? resolved.discount : 0;
});

const discountTotal = computed(() => lineDiscountTotal.value + globalDiscount.value);
const saleTotal = computed(() => Math.max(0, subtotal.value - discountTotal.value));

const paymentsSum = computed(() =>
  payments.value.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
);

const paymentDiff = computed(() => paymentsSum.value - saleTotal.value);
const remaining = computed(() => Math.max(0, saleTotal.value - paymentsSum.value));

const changePreview = computed(() => {
  let change = 0;
  for (const p of payments.value) {
    if (p.method !== 'EFECTIVO') continue;
    const amount = Number(p.amount) || 0;
    const received = Number(p.cashReceived) || 0;
    if (received >= amount) change += received - amount;
  }
  return change;
});

const stockBlocked = computed(() => cartHasBlockedStock(cart.value));

const canSubmit = computed(() => {
  if (selling.value || !cart.value.length || stockBlocked.value) return false;
  if (customer.name.trim().length < 2) return false;
  if (paymentsSum.value !== saleTotal.value) return false;
  if (discountTotal.value > 0 && discountReason.value.trim().length < 3) return false;
  for (const p of payments.value) {
    const amount = Number(p.amount) || 0;
    if (amount <= 0) return false;
    if (p.method === 'EFECTIVO') {
      const received = Number(p.cashReceived) || 0;
      if (received < amount) return false;
    }
    if (p.method === 'DATAFONO_BOLD' && !/^\d{4,12}$/.test(p.approvalCode.trim())) {
      return false;
    }
  }
  return true;
});

const submitBlockReason = computed(() => {
  if (selling.value) return '';
  if (!cart.value.length) return 'Carrito vacío';
  if (stockBlocked.value) return 'Stock insuficiente';
  if (customer.name.trim().length < 2) return 'Falta el nombre del cliente';
  if (discountTotal.value > 0 && discountReason.value.trim().length < 3) {
    return 'Falta el motivo del descuento';
  }
  if (paymentsSum.value !== saleTotal.value) {
    const gap = saleTotal.value - paymentsSum.value;
    if (gap > 0) return `Los pagos no cuadran: faltan ${formatCop(gap)}`;
    return `Los pagos no cuadran: sobran ${formatCop(-gap)}`;
  }
  for (const p of payments.value) {
    const amount = Number(p.amount) || 0;
    if (amount <= 0) return 'Falta el monto de un pago';
    if (p.method === 'EFECTIVO') {
      const received = Number(p.cashReceived) || 0;
      if (received < amount) return 'El efectivo recibido no cubre el monto';
    }
    if (p.method === 'DATAFONO_BOLD' && !/^\d{4,12}$/.test(p.approvalCode.trim())) {
      return 'Falta el código de aprobación del datáfono';
    }
  }
  return '';
});

function emptyPayment(
  method: PaymentDraft['method'] = 'EFECTIVO',
): PaymentDraft {
  return {
    id: `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method,
    amount: null,
    amountTouched: false,
    cashReceived: null,
    reference: '',
    proofUrl: '',
    approvalCode: '',
    cardLast4: '',
  };
}

function isTimeoutError(err: unknown) {
  const name = (err as { name?: string })?.name ?? '';
  const message = err instanceof Error ? err.message : String(err ?? '');
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|aborted/i.test(message);
}

function onManualSearchInput() {
  if (manualTimer) clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    void runManualSearch();
  }, 300);
}

async function runManualSearch(forced?: string) {
  const q = (forced ?? manualSearch.value).trim();
  if (forced !== undefined) manualSearch.value = q;
  if (q.length < 2) {
    manualHits.value = [];
    manualOpen.value = false;
    manualHighlight.value = -1;
    return;
  }
  manualBusy.value = true;
  manualOpen.value = true;
  try {
    const data = await api.get<PosWatchDto[]>('/pos/watches', {
      search: q,
    });
    manualHits.value = Array.isArray(data) ? data : [];
    manualHighlight.value = manualHits.value.length ? 0 : -1;
    for (const key of Object.keys(manualBroken)) {
      manualBroken[key] = false;
    }
  } catch (err: unknown) {
    manualHits.value = [];
    manualHighlight.value = -1;
    toast.error(extractApiErrorMessage(err, 'No se pudo buscar.'));
  } finally {
    manualBusy.value = false;
  }
}

function manualThumb(watch: PosWatchDto) {
  if (manualBroken[watch.id] || !watch.imageUrl) return null;
  return optimizeCloudinaryImageUrl(
    resolveMedia(watch.imageUrl) ?? watch.imageUrl,
    96,
  );
}

function closeManualHits() {
  manualOpen.value = false;
  manualHighlight.value = -1;
}

function onManualKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (manualOpen.value || manualHits.value.length) {
      event.preventDefault();
      closeManualHits();
      manualHits.value = [];
    }
    return;
  }
  if (!manualHits.value.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    manualOpen.value = true;
    manualHighlight.value =
      (manualHighlight.value + 1) % manualHits.value.length;
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    manualOpen.value = true;
    manualHighlight.value =
      (manualHighlight.value - 1 + manualHits.value.length) %
      manualHits.value.length;
    return;
  }
  if (event.key === 'Enter') {
    const hit =
      manualHits.value[manualHighlight.value] ?? manualHits.value[0];
    if (!hit) return;
    event.preventDefault();
    addManualHit(hit);
  }
}

function addManualHit(watch: PosWatchDto) {
  upsertWatch(watch, 1);
  manualSearch.value = '';
  manualHits.value = [];
  closeManualHits();
}

function upsertWatch(watch: PosWatchDto, qty = 1) {
  const label = `${watch.brandName} ${watch.model}`.trim();
  const existing = cart.value.find((line) => line.watchId === watch.id);
  if (watch.stock <= 0) {
    playBeep('error');
    toast.error(`${label} está agotado`);
    return;
  }
  if (existing) {
    if (existing.quantity + qty > watch.stock) {
      playBeep('error');
      toast.warning(
        `No hay más unidades de ${label} (disponibles: ${watch.stock})`,
      );
      return;
    }
    existing.quantity += qty;
    existing.stock = watch.stock;
    existing.imageUrl = watch.imageUrl;
    existing.limitedEditionNumber = watch.limitedEditionNumber;
    existing.warrantyMonths = watch.warrantyMonths;
  } else {
    if (watch.stock < qty) {
      playBeep('error');
      toast.warning(
        `No hay más unidades de ${label} (disponibles: ${watch.stock})`,
      );
      return;
    }
    cart.value.push({
      watchId: watch.id,
      sku: watch.sku,
      brandName: watch.brandName,
      model: watch.model,
      retailPrice: watch.retailPrice,
      stock: watch.stock,
      imageUrl: watch.imageUrl,
      limitedEditionNumber: watch.limitedEditionNumber,
      warrantyMonths: watch.warrantyMonths,
      quantity: qty,
      discountMode: 'amount',
      discountValue: 0,
    });
  }
  playBeep('ok');
  toast.success(`Agregado: ${label}`);
  idempotencyKey.value = crypto.randomUUID();
}

async function syncCartStock(loaded: PosWatchDto[]) {
  const byId = new Map(loaded.map((watch) => [watch.id, watch.stock]));
  for (const line of cart.value) {
    if (byId.has(line.watchId)) {
      line.stock = byId.get(line.watchId) ?? line.stock;
      continue;
    }
    try {
      const fresh = await api.get<PosWatchDto>(
        `/pos/watches/by-sku/${encodeURIComponent(line.sku)}`,
      );
      line.stock = fresh.stock;
    } catch {
      /* el ítem sigue con el stock anterior */
    }
  }
}

async function reloadCatalogSilent() {
  await catalogRef.value?.reloadSilent();
}

useLiveRefresh(reloadCatalogSilent, {
  intervalMs: 20_000,
  pauseWhen: () =>
    selling.value
    || Boolean(successSale.value)
    || manualOpen.value
    || Boolean(catalogRef.value?.previewOpen),
});

function setQty(line: CartLine, next: number) {
  if (next <= 0) {
    cart.value = cart.value.filter((item) => item.watchId !== line.watchId);
    return;
  }
  if (next > line.stock) {
    toast.warning(
      `No hay más unidades de ${line.brandName} ${line.model} (disponibles: ${line.stock})`,
    );
    return;
  }
  line.quantity = next;
}

function clearCart(opts?: { keepSuccess?: boolean }) {
  cart.value = [];
  payments.value = [emptyPayment('EFECTIVO')];
  note.value = '';
  globalDiscountValue.value = 0;
  discountReason.value = '';
  idempotencyKey.value = crypto.randomUUID();
  customer.name = '';
  customer.document = '';
  customer.phone = '';
  customer.email = '';
  customerHints.value = [];
  if (!opts?.keepSuccess) successSale.value = null;
}

function startNewSale() {
  clearCart();
  successSale.value = null;
  successPhone.value = '';
}

function addPayment() {
  if (payments.value.length >= 4) return;
  const draft = emptyPayment('TRANSFERENCIA');
  draft.amount = Math.max(0, saleTotal.value - paymentsSum.value);
  payments.value.push(draft);
}

function removePayment(id: string) {
  if (payments.value.length <= 1) return;
  payments.value = payments.value.filter((p) => p.id !== id);
}

function fillRemaining(payment: PaymentDraft) {
  const others = paymentsSum.value - (Number(payment.amount) || 0);
  payment.amount = Math.max(0, saleTotal.value - others);
  payment.amountTouched = true;
}

function onPaymentAmount(payment: PaymentDraft) {
  payment.amountTouched = true;
}

watch(saleTotal, (total) => {
  if (payments.value.length !== 1) return;
  const payment = payments.value[0];
  if (!payment || payment.amountTouched) return;
  payment.amount = total;
});

async function searchCustomers() {
  const q = customer.phone.trim() || customer.name.trim();
  if (q.length < 3) {
    customerHints.value = [];
    return;
  }
  try {
    customerHints.value = await api.get<PosCustomerHintDto[]>('/pos/customers', {
      q,
    });
  } catch {
    customerHints.value = [];
  }
}

function onCustomerInput() {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    void searchCustomers();
  }, 250);
}

function applyHint(hint: PosCustomerHintDto) {
  customer.name = hint.customerName || customer.name;
  customer.phone = hint.customerPhone ?? '';
  customer.email = hint.customerEmail ?? '';
  customer.document = hint.customerDocument ?? '';
  customerHints.value = [];
}

async function uploadProof(payment: PaymentDraft, file: File) {
  payment.uploading = true;
  try {
    const uploadBase = useApiUploadUrl().replace(/\/$/, '');
    const crossOrigin =
      /^https?:\/\//i.test(uploadBase) && !uploadBase.startsWith('/');
    async function post(token: string) {
      const body = new FormData();
      body.append('file', file);
      return fetch(`${uploadBase}/pos/proof`, {
        method: 'POST',
        body,
        credentials: crossOrigin ? 'omit' : 'include',
        headers: authFetchHeaders(token),
      });
    }
    let token = await auth.ensureUploadToken();
    let res = await post(token);
    if (res.status === 401) {
      token = await auth.ensureUploadToken(true);
      res = await post(token);
    }
    if (!res.ok) {
      throw new Error('No se pudo subir el comprobante.');
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error('Sin URL de comprobante');
    payment.proofUrl = data.url;
    toast.success('Comprobante cargado.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo subir el archivo.'));
  } finally {
    payment.uploading = false;
  }
}

function onProofSelected(payment: PaymentDraft, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast.warning('Máximo 5MB.');
    return;
  }
  void uploadProof(payment, file);
}

function openReceipt(receiptId: string, inline = false) {
  const query = inline ? '?inline=1' : '';
  window.open(
    `${config.public.apiBaseUrl}/receipts/${receiptId}/pdf${query}`,
    '_blank',
  );
}

function sendWhatsapp() {
  const phone = whatsappPhoneCo(successPhone.value);
  const sale = successSale.value;
  if (!phone || !sale) return;
  const when = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const text = `LUXTIMEE\nComprobante ${sale.receiptNumber}\nTotal ${formatCop(sale.total)}\n${when}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
}

function salePayload() {
  return {
    customer: {
      name: customer.name.trim(),
      document: customer.document.trim() || undefined,
      phone: customer.phone.trim() || undefined,
      email: customer.email.trim() || undefined,
    },
    items: cart.value.map((line) => ({
      watchId: line.watchId,
      quantity: line.quantity,
      discountAmount: line.discountMode === 'amount'
        ? Math.round(Number(line.discountValue) || 0)
        : undefined,
      discountPercent: line.discountMode === 'percent'
        ? Math.round(Number(line.discountValue) || 0)
        : undefined,
    })),
    payments: payments.value.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      cashReceived: p.method === 'EFECTIVO' ? Number(p.cashReceived) : undefined,
      reference: p.method === 'TRANSFERENCIA' ? p.reference || undefined : undefined,
      proofUrl: p.proofUrl || undefined,
      approvalCode: p.method === 'DATAFONO_BOLD' ? p.approvalCode || undefined : undefined,
      cardLast4: p.method === 'DATAFONO_BOLD' ? p.cardLast4 || undefined : undefined,
    })),
    note: note.value.trim() || undefined,
    discountAmount: globalDiscountMode.value === 'amount'
      ? Math.round(Number(globalDiscountValue.value) || 0)
      : undefined,
    discountPercent: globalDiscountMode.value === 'percent'
      ? Math.round(Number(globalDiscountValue.value) || 0)
      : undefined,
    discountReason: discountReason.value.trim() || undefined,
    idempotencyKey: idempotencyKey.value,
  };
}

async function submitSale() {
  if (!canSubmit.value) return;
  const ok = await confirm({
    title: 'Confirmar venta',
    message: `¿Registrar venta por ${formatCop(saleTotal.value)}?`,
    confirmLabel: 'Registrar venta',
  });
  if (!ok) return;

  selling.value = true;
  const phone = customer.phone;
  try {
    let result: PosSaleResultDto;
    try {
      result = await api.post<PosSaleResultDto>('/pos/sales', salePayload(), {
        timeout: POS_SALE_TIMEOUT_MS,
      });
    } catch (err: unknown) {
      if (!isTimeoutError(err)) throw err;
      try {
        result = await api.get<PosSaleResultDto>(
          `/pos/sales/by-idempotency/${idempotencyKey.value}`,
        );
      } catch {
        result = await api.post<PosSaleResultDto>('/pos/sales', salePayload(), {
          timeout: POS_SALE_TIMEOUT_MS,
        });
      }
    }
    playBeep('ok');
    successPhone.value = phone;
    clearCart({ keepSuccess: true });
    successSale.value = result;
    void catalogRef.value?.reloadSilent();
  } catch (err: unknown) {
    playBeep('error');
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la venta.'));
    void catalogRef.value?.reloadSilent();
  } finally {
    selling.value = false;
  }
}

onBeforeUnmount(() => {
  if (hintTimer) clearTimeout(hintTimer);
  if (manualTimer) clearTimeout(manualTimer);
});
</script>

<template>
  <div class="admin-records-page pos-page">
    <UiSectionHeader label="Punto de venta" title="POS" />

    <div
      v-if="successSale"
      class="pos-success-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-success-title"
    >
      <div class="pos-success-modal__card admin-record-card p-5">
        <h2 id="pos-success-title" class="admin-record-title">
          Venta registrada
        </h2>
        <p>N.º de pedido: <strong>{{ successSale.readableId }}</strong></p>
        <p>
          N.º de comprobante:
          <strong>{{ successSale.receiptNumber }}</strong>
        </p>
        <p
          v-if="successSale.changeTotal > 0"
          class="pos-success-modal__change"
        >
          Cambio a entregar
          <strong>{{ formatCop(successSale.changeTotal) }}</strong>
        </p>
        <div class="pos-success-modal__actions">
          <button
            type="button"
            class="admin-record-btn admin-record-btn--primary"
            @click="openReceipt(successSale.receiptId)"
          >
            Descargar comprobante
          </button>
          <button
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            @click="openReceipt(successSale.receiptId, true)"
          >
            Imprimir
          </button>
          <button
            v-if="whatsappPhoneCo(successPhone)"
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            @click="sendWhatsapp"
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            @click="startNewSale"
          >
            Nueva venta
          </button>
        </div>
      </div>
    </div>

    <div class="pos-layout">
      <div class="pos-top">
      <section class="pos-zone admin-record-card p-4">
        <h2 class="admin-record-title">Carrito</h2>

        <div class="pos-field pos-manual" @keydown="onManualKeydown">
          <span>Búsqueda manual</span>
          <UiLuxInput
            v-model="manualSearch"
            placeholder="SKU, marca o modelo"
            autocomplete="off"
            @input="onManualSearchInput"
            @focus="manualOpen = manualHits.length > 0 || manualBusy"
          />
          <p v-if="manualBusy" class="admin-record-muted pos-manual__status">
            Buscando…
          </p>
          <p
            v-else-if="manualOpen && manualSearch.trim().length >= 2 && !manualHits.length"
            class="admin-record-muted pos-manual__status"
          >
            Sin resultados para “{{ manualSearch.trim() }}”
          </p>
          <ul
            v-if="manualOpen && manualHits.length"
            class="pos-manual__list"
            role="listbox"
            aria-label="Resultados de búsqueda"
          >
            <li
              v-for="(hit, idx) in manualHits"
              :key="hit.id"
              role="option"
              :aria-selected="idx === manualHighlight"
            >
              <button
                type="button"
                class="pos-manual__hit"
                :class="{ 'is-active': idx === manualHighlight }"
                @mouseenter="manualHighlight = idx"
                @click="addManualHit(hit)"
              >
                <img
                  v-if="manualThumb(hit)"
                  :src="manualThumb(hit)!"
                  :alt="`${hit.brandName} ${hit.model}`"
                  class="pos-manual__thumb"
                  loading="lazy"
                  @error="manualBroken[hit.id] = true"
                >
                <span
                  v-else
                  class="pos-manual__thumb pos-manual__thumb--empty"
                  aria-hidden="true"
                >
                  {{ photoInitials(hit.brandName, hit.model) }}
                </span>
                <span class="pos-manual__meta">
                  <strong>{{ hit.brandName }} {{ hit.model }}</strong>
                  <span class="pos-manual__sku">{{ hit.sku }}</span>
                  <span>{{ formatCop(hit.retailPrice) }}</span>
                </span>
                <span
                  class="pos-manual__badge"
                  :class="{ 'is-last': hit.stock === 1 }"
                >
                  {{ stockBadge(hit.stock) }}
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!cart.length" class="admin-record-empty">
          Carrito vacío. Busca por SKU, marca o modelo, o agrégalo desde el catálogo.
        </div>

        <ul v-else class="pos-cart">
          <li
            v-for="line in cart"
            :key="line.watchId"
            class="pos-cart__line"
            :class="{ 'pos-cart__line--blocked': line.stock <= 0 || line.quantity > line.stock }"
          >
            <img
              v-if="line.imageUrl"
              :src="line.imageUrl"
              :alt="`${line.brandName} ${line.model}`"
              class="pos-cart__thumb"
              loading="lazy"
            >
            <div v-else class="pos-cart__thumb pos-cart__thumb--empty" />
            <div class="pos-cart__main">
              <p class="pos-cart__name">{{ line.brandName }} {{ line.model }}</p>
              <p class="pos-cart__sku">{{ line.sku }}</p>
              <p
                v-if="line.limitedEditionNumber"
                class="pos-cart__meta"
              >
                Edición limitada N.º {{ line.limitedEditionNumber }}
              </p>
              <p class="pos-cart__meta">
                {{
                  line.warrantyMonths > 0
                    ? `${line.warrantyMonths} meses`
                    : 'Sin garantía'
                }}
              </p>
              <p class="pos-cart__price">
                {{ formatCop(line.retailPrice) }} · stock {{ line.stock }}
              </p>
              <span
                v-if="line.quantity > line.stock || line.stock === 0"
                class="pos-cart__badge"
              >
                Stock insuficiente. Ajusta la cantidad o quita el reloj.
              </span>
            </div>
            <div class="pos-cart__discount">
              <select v-model="line.discountMode" class="admin-input">
                <option value="amount">$ desc.</option>
                <option value="percent">% desc.</option>
              </select>
              <input
                v-model.number="line.discountValue"
                class="admin-input"
                type="number"
                min="0"
                :max="line.discountMode === 'percent' ? 100 : line.retailPrice * line.quantity"
                step="1"
              >
            </div>
            <div class="pos-cart__qty">
              <button
                type="button"
                class="admin-btn"
                @click="setQty(line, line.quantity - 1)"
              >
                −
              </button>
              <span>{{ line.quantity }}</span>
              <button
                type="button"
                class="admin-btn"
                @click="setQty(line, line.quantity + 1)"
              >
                +
              </button>
            </div>
            <div class="pos-cart__side">
              <p class="pos-cart__line-total">
                {{ formatCop(line.retailPrice * line.quantity - lineDiscountOf(line)) }}
              </p>
              <button
                type="button"
                class="admin-link-btn"
                @click="setQty(line, 0)"
              >
                Quitar
              </button>
            </div>
          </li>
        </ul>

        <div class="pos-discount">
          <span>Descuento de la venta</span>
          <select v-model="globalDiscountMode" class="admin-input">
            <option value="amount">Monto</option>
            <option value="percent">Porcentaje</option>
          </select>
          <input v-model.number="globalDiscountValue" class="admin-input" type="number" min="0" step="1">
          <input
            v-model="discountReason"
            class="admin-input"
            type="text"
            maxlength="200"
            placeholder="Motivo del descuento"
          >
        </div>
        <div class="pos-cart__footer">
          <p>Subtotal {{ formatCop(subtotal) }}</p>
          <p v-if="discountTotal">Descuento {{ formatCop(discountTotal) }}</p>
          <strong>Total {{ formatCop(saleTotal) }}</strong>
          <button
            v-if="cart.length"
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            @click="clearCart()"
          >
            Vaciar
          </button>
        </div>
      </section>

      <section class="pos-zone admin-record-card p-4">
        <h2 class="admin-record-title">Cliente y pagos</h2>

        <div class="pos-customer">
          <label class="pos-field">
            <span>Nombre</span>
            <UiLuxInput
              v-model="customer.name"
              placeholder="Nombre del cliente"
              required
              @input="onCustomerInput"
            />
          </label>
          <label class="pos-field">
            <span>Teléfono (opcional)</span>
            <UiLuxInput
              v-model="customer.phone"
              placeholder="Teléfono"
              @input="onCustomerInput"
            />
          </label>
          <label class="pos-field">
            <span>Documento (opcional)</span>
            <UiLuxInput v-model="customer.document" placeholder="Documento" />
          </label>
          <label class="pos-field">
            <span>Email (opcional)</span>
            <UiLuxInput
              v-model="customer.email"
              type="email"
              placeholder="Email"
            />
          </label>
          <ul v-if="customerHints.length" class="pos-hints">
            <li
              v-for="hint in customerHints"
              :key="`${hint.customerPhone}-${hint.customerName}`"
            >
              <button type="button" @click="applyHint(hint)">
                {{ hint.customerName }} · {{ hint.customerPhone }}
              </button>
            </li>
          </ul>
        </div>

        <div class="pos-payments">
          <div
            v-for="payment in payments"
            :key="payment.id"
            class="pos-payment"
          >
            <div class="pos-payment__row">
              <select v-model="payment.method" class="admin-input">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="DATAFONO_BOLD">Datáfono Bold</option>
              </select>
              <input
                v-model.number="payment.amount"
                class="admin-input"
                type="number"
                min="1"
                step="1"
                placeholder="Monto"
                @input="onPaymentAmount(payment)"
              >
              <button
                type="button"
                class="admin-link-btn"
                @click="fillRemaining(payment)"
              >
                Usar el saldo restante
              </button>
              <button
                v-if="payments.length > 1"
                type="button"
                class="admin-link-btn"
                @click="removePayment(payment.id)"
              >
                Quitar
              </button>
            </div>

            <div v-if="payment.method === 'EFECTIVO'" class="pos-payment__row">
              <input
                v-model.number="payment.cashReceived"
                class="admin-input"
                type="number"
                min="0"
                step="1"
                placeholder="Recibido"
              >
              <span class="admin-record-muted">
                Cambio:
                {{
                  formatCop(
                    Math.max(
                      0,
                      (Number(payment.cashReceived) || 0) -
                        (Number(payment.amount) || 0),
                    ),
                  )
                }}
              </span>
            </div>

            <div
              v-else-if="payment.method === 'TRANSFERENCIA'"
              class="pos-payment__row"
            >
              <input
                v-model="payment.reference"
                class="admin-input"
                placeholder="Referencia (opcional)"
                maxlength="80"
              >
              <label class="admin-record-btn admin-record-btn--ghost">
                {{
                  payment.uploading
                    ? 'Subiendo…'
                    : payment.proofUrl
                      ? 'Comprobante OK'
                      : 'Adjuntar soporte'
                }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  :disabled="payment.uploading"
                  @change="onProofSelected(payment, $event)"
                >
              </label>
            </div>

            <div v-else class="pos-payment__row">
              <input
                v-model="payment.approvalCode"
                class="admin-input"
                placeholder="Aprobación"
                maxlength="12"
              >
              <input
                v-model="payment.cardLast4"
                class="admin-input"
                placeholder="Últimos 4"
                maxlength="4"
              >
            </div>
          </div>

          <button
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            :disabled="payments.length >= 4"
            @click="addPayment"
          >
            Agregar método
          </button>
        </div>

        <label class="pos-field">
          <span>Nota (opcional)</span>
          <textarea
            v-model="note"
            class="admin-record-textarea"
            rows="2"
            maxlength="300"
          />
        </label>

        <div class="pos-checkout">
          <div>
            <p>
              Pagos {{ formatCop(paymentsSum) }} / {{ formatCop(saleTotal) }}
              · Restante: {{ formatCop(remaining) }}
              <span v-if="changePreview">
                · Cambio {{ formatCop(changePreview) }}
              </span>
            </p>
            <p
              v-if="paymentDiff !== 0 && saleTotal > 0"
              class="pos-checkout__diff"
              :class="paymentDiff < 0 ? 'is-short' : 'is-over'"
            >
              {{
                paymentDiff < 0
                  ? `Falta ${formatCop(-paymentDiff)}`
                  : `Sobra ${formatCop(paymentDiff)}`
              }}
            </p>
          </div>
          <button
            type="button"
            class="admin-record-btn admin-record-btn--primary"
            :disabled="!canSubmit"
            @click="submitSale"
          >
            {{ selling ? 'Registrando…' : 'Registrar venta' }}
          </button>
          <p v-if="submitBlockReason" class="admin-record-muted">{{ submitBlockReason }}</p>
        </div>
      </section>
      </div>

      <section class="pos-zone pos-catalog-zone admin-record-card p-4">
        <h2 class="admin-record-title">Catálogo</h2>
        <AdminPosCatalog
          ref="catalogRef"
          :cart-qty-by-id="cartQtyById"
          :paused="selling"
          @add="upsertWatch($event, 1)"
          @refreshed="syncCartStock"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.pos-page.admin-records-page {
  max-width: min(1600px, 100%);
  min-width: 0;
}

.pos-page .admin-input {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.pos-layout {
  display: grid;
  gap: 1rem;
}

.pos-top {
  display: grid;
  gap: 1rem;
}

.pos-discount,
.pos-cart__discount {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.pos-discount .admin-input,
.pos-cart__discount .admin-input {
  width: auto;
  min-width: 0;
}

.pos-zone {
  display: grid;
  gap: 0.85rem;
  align-content: start;
}

.pos-field {
  display: grid;
  gap: 0.35rem;
}

.pos-field span {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim, #9ca3af);
}

.pos-scan-row {
  display: grid;
  gap: 0.45rem;
}

.pos-scan-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: #9ca3af;
}

.pos-scan-status::before {
  content: '';
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: #6b7280;
}

.pos-scan-status--ready {
  color: #86efac;
}

.pos-scan-status--ready::before {
  background: #22c55e;
}

.pos-cart {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.pos-cart__line--blocked {
  background: rgba(180, 60, 50, 0.08);
  outline: 1px solid rgba(180, 60, 50, 0.45);
}

.pos-cart__line {
  display: grid;
  gap: 0.35rem 0.5rem;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  grid-template-areas:
    "thumb main side"
    "thumb qty side";
  align-items: center;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
  padding-bottom: 0.65rem;
}

.pos-cart__thumb {
  grid-area: thumb;
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: #fff;
  border-radius: 4px;
}

.pos-cart__thumb--empty {
  background: rgba(255, 255, 255, 0.08);
}

.pos-cart__main {
  grid-area: main;
  min-width: 0;
}

.pos-cart__name {
  margin: 0;
  font-weight: 700;
}

.pos-cart__sku,
.pos-cart__price,
.pos-cart__meta {
  margin: 0;
  font-size: 0.85rem;
  color: #9ca3af;
}

.pos-cart__badge {
  display: inline-block;
  margin-top: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #7f1d1d;
  color: #fff;
  font-size: 0.72rem;
}

.pos-cart__qty {
  grid-area: qty;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pos-cart__side {
  grid-area: side;
  display: grid;
  gap: 0.25rem;
  justify-items: end;
}

.pos-cart__line-total {
  margin: 0;
  font-weight: 600;
}

.pos-cart__footer,
.pos-checkout {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.pos-checkout__diff.is-short {
  color: #fca5a5;
}

.pos-checkout__diff.is-over {
  color: #fcd34d;
}

.pos-customer,
.pos-payments {
  display: grid;
  gap: 0.65rem;
}

.pos-payment,
.pos-payment__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.pos-manual {
  position: relative;
}

.pos-manual__status {
  margin: 0.35rem 0 0;
}

.pos-manual__list {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.28);
  background: rgba(20, 20, 20, 0.96);
  max-height: 320px;
  overflow: auto;
  z-index: 5;
}

.pos-manual__hit {
  width: 100%;
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 0.65rem;
  align-items: center;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
}

.pos-manual__hit:hover,
.pos-manual__hit.is-active {
  background: rgba(200, 169, 110, 0.14);
}

.pos-manual__thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 2px;
  background: #f3eee3;
}

.pos-manual__thumb--empty {
  display: grid;
  place-items: center;
  color: var(--lux-gold, #b8962e);
  font-family: var(--lux-font-display, Cormorant, Georgia, serif);
  font-size: 0.95rem;
}

.pos-manual__meta {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.pos-manual__meta strong {
  font-size: 0.92rem;
  line-height: 1.25;
}

.pos-manual__sku {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: #9ca3af;
}

.pos-manual__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(200, 169, 110, 0.16);
  color: #e8d7a8;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.pos-manual__badge.is-last {
  background: rgba(180, 83, 9, 0.22);
  color: #fdba74;
}

.pos-hints {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.2);
}

.pos-hints button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
}

.pos-hints button:hover {
  background: rgba(200, 169, 110, 0.12);
}

.pos-success-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.72);
}

.pos-success-modal__card {
  width: min(420px, 100%);
  display: grid;
  gap: 0.75rem;
}

.pos-success-modal__change {
  font-size: 1.35rem;
}

.pos-success-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (min-width: 700px) and (max-width: 1099px) {
  .pos-top {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1100px) {
  .pos-top {
    grid-template-columns: minmax(320px, 1.1fr) minmax(300px, 0.9fr);
    align-items: start;
  }
}

@media (max-width: 700px) {
  .pos-layout,
  .pos-zone,
  .pos-field,
  .pos-scan-row,
  .pos-customer,
  .pos-payments,
  .pos-payment,
  .pos-payment__row,
  .pos-checkout,
  .pos-cart,
  .pos-cart__line,
  .pos-cart__main,
  .pos-cart__footer,
  .pos-manual,
  .pos-manual__hit,
  .pos-manual__meta {
    min-width: 0;
    max-width: 100%;
  }

  .pos-cart__line {
    grid-template-columns: 48px minmax(0, 1fr);
    grid-template-areas:
      "thumb main"
      "qty qty"
      "side side";
  }

  .pos-cart__side {
    justify-items: start;
  }

  .pos-cart__name,
  .pos-cart__sku,
  .pos-cart__meta,
  .pos-checkout p {
    overflow-wrap: anywhere;
  }

  .pos-payment__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .pos-checkout,
  .pos-cart__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .pos-manual__hit {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .pos-manual__badge {
    justify-self: start;
  }
}
</style>
