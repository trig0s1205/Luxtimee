<script setup lang="ts">
import type {
  PosCustomerHintDto,
  PosSaleResultDto,
  PosWatchDto,
} from '@luxtime/shared';
import { authFetchHeaders } from '~/utils/auth-token';
import { extractApiErrorMessage } from '~/utils/api-error';
import {
  createScanDetector,
  looksLikeSku,
  normalizeScannedCode,
} from '~/utils/barcode-scan';
import { playBeep } from '~/utils/pos-feedback';
import { formatCop } from '~/utils/format';
import { optimizeCloudinaryImageUrl } from '~/utils/media-url';
import {
  photoInitials,
  stockBadge,
} from '~/utils/pos-catalog';

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
};

type PaymentDraft = {
  id: string;
  method: 'EFECTIVO' | 'TRANSFERENCIA' | 'DATAFONO_BOLD';
  amount: number | null;
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
const catalogRef = ref<{ reload: () => Promise<void> } | null>(null);

const scanInput = ref('');
const scanBusy = ref(false);
const scanEl = ref<HTMLInputElement | null>(null);
const scanFocused = ref(false);
const detector = createScanDetector();
const windowDetector = createScanDetector();

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
const payments = ref<PaymentDraft[]>([emptyPayment('EFECTIVO')]);
const selling = ref(false);
const successSale = ref<PosSaleResultDto | null>(null);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const cartQtyById = computed(() => {
  const map: Record<string, number> = {};
  for (const line of cart.value) map[line.watchId] = line.quantity;
  return map;
});

const subtotal = computed(() =>
  cart.value.reduce((sum, line) => sum + line.retailPrice * line.quantity, 0),
);

const paymentsSum = computed(() =>
  payments.value.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
);

const paymentDiff = computed(() => paymentsSum.value - subtotal.value);

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

const canSubmit = computed(() => {
  if (selling.value || !cart.value.length) return false;
  if (customer.name.trim().length < 2) return false;
  if (paymentsSum.value !== subtotal.value) return false;
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

function emptyPayment(
  method: PaymentDraft['method'] = 'EFECTIVO',
): PaymentDraft {
  return {
    id: `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method,
    amount: null,
    cashReceived: null,
    reference: '',
    proofUrl: '',
    approvalCode: '',
    cardLast4: '',
  };
}

function isFormField(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('[role="dialog"]'));
}

function focusScanner() {
  nextTick(() => scanEl.value?.focus());
}

function onScanBlur() {
  scanFocused.value = false;
  window.setTimeout(() => {
    if (isFormField(document.activeElement)) return;
    focusScanner();
  }, 150);
}

function onScanFocus() {
  scanFocused.value = true;
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
  focusScanner();
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
    });
  }
  playBeep('ok');
  toast.success(`Agregado: ${label}`);
  focusScanner();
}

async function resolveCode(raw: string, opts?: { alsoManualSearch?: boolean }) {
  const code = normalizeScannedCode(raw);
  if (!code) return;
  scanBusy.value = true;
  try {
    const watch = await api.get<PosWatchDto>(
      `/pos/watches/by-sku/${encodeURIComponent(code)}`,
    );
    upsertWatch(watch, 1);
  } catch (err: unknown) {
    playBeep('error');
    toast.error(extractApiErrorMessage(err, `Código no encontrado: ${code}`));
    if (opts?.alsoManualSearch) {
      await runManualSearch(raw.trim());
    }
  } finally {
    scanBusy.value = false;
    scanInput.value = '';
    focusScanner();
  }
}

async function handleScanEnter(text: string, fromScan: boolean) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (fromScan || looksLikeSku(trimmed)) {
    await resolveCode(trimmed, { alsoManualSearch: !fromScan });
    return;
  }
  await runManualSearch(trimmed);
  scanInput.value = '';
}

function onScanKeydown(event: KeyboardEvent) {
  const result = detector.push(event.key, performance.now());
  if (event.key === 'Enter') {
    event.preventDefault();
    if (result?.type === 'scan') {
      void handleScanEnter(result.code, true);
      return;
    }
    void handleScanEnter(scanInput.value, false);
    return;
  }
  if (result?.type === 'scan') {
    event.preventDefault();
    void handleScanEnter(result.code, true);
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if (isFormField(document.activeElement)) return;
  if (document.activeElement === scanEl.value) return;
  const result = windowDetector.push(event.key, performance.now());
  if (result?.type === 'scan') {
    event.preventDefault();
    void handleScanEnter(result.code, true);
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && !successSale.value) {
    focusScanner();
  }
}

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
  focusScanner();
}

function addPayment() {
  if (payments.value.length >= 4) return;
  payments.value.push(emptyPayment('TRANSFERENCIA'));
}

function removePayment(id: string) {
  if (payments.value.length <= 1) return;
  payments.value = payments.value.filter((p) => p.id !== id);
}

function fillRemaining(payment: PaymentDraft) {
  const others = paymentsSum.value - (Number(payment.amount) || 0);
  payment.amount = Math.max(0, subtotal.value - others);
}

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

function openReceipt(receiptId: string) {
  window.open(
    `${config.public.apiBaseUrl}/receipts/${receiptId}/pdf`,
    '_blank',
  );
}

async function submitSale() {
  if (!canSubmit.value) return;
  const ok = await confirm({
    title: 'Confirmar venta',
    message: `¿Registrar venta por ${formatCop(subtotal.value)}?`,
    confirmLabel: 'Registrar venta',
  });
  if (!ok) {
    focusScanner();
    return;
  }

  selling.value = true;
  try {
    const result = await api.post<PosSaleResultDto>('/pos/sales', {
      customer: {
        name: customer.name.trim(),
        document: customer.document.trim() || undefined,
        phone: customer.phone.trim() || undefined,
        email: customer.email.trim() || undefined,
      },
      items: cart.value.map((line) => ({
        watchId: line.watchId,
        quantity: line.quantity,
      })),
      payments: payments.value.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        cashReceived:
          p.method === 'EFECTIVO' ? Number(p.cashReceived) : undefined,
        reference:
          p.method === 'TRANSFERENCIA' ? p.reference || undefined : undefined,
        proofUrl: p.proofUrl || undefined,
        approvalCode:
          p.method === 'DATAFONO_BOLD' ? p.approvalCode || undefined : undefined,
        cardLast4:
          p.method === 'DATAFONO_BOLD' ? p.cardLast4 || undefined : undefined,
      })),
      note: note.value.trim() || undefined,
    });
    playBeep('ok');
    clearCart({ keepSuccess: true });
    successSale.value = result;
    await catalogRef.value?.reload();
  } catch (err: unknown) {
    playBeep('error');
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la venta.'));
    await catalogRef.value?.reload();
  } finally {
    selling.value = false;
  }
}

onMounted(() => {
  focusScanner();
  window.addEventListener('keydown', onWindowKeydown);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  if (hintTimer) clearTimeout(hintTimer);
  if (manualTimer) clearTimeout(manualTimer);
  window.removeEventListener('keydown', onWindowKeydown);
  document.removeEventListener('visibilitychange', onVisibilityChange);
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
            @click="startNewSale"
          >
            Nueva venta
          </button>
        </div>
        <p class="admin-record-muted">
          Envíaselo al cliente por WhatsApp
        </p>
      </div>
    </div>

    <div class="pos-layout">
      <section class="pos-zone admin-record-card p-4">
        <h2 class="admin-record-title">Escáner y carrito</h2>
        <label class="pos-field">
          <span>SKU / código de barras</span>
          <div class="pos-scan-row">
            <input
              ref="scanEl"
              v-model="scanInput"
              class="admin-input"
              type="text"
              autocomplete="off"
              inputmode="search"
              enterkeyhint="search"
              :disabled="scanBusy || !!successSale"
              placeholder="Escanea el código o busca por SKU, marca o modelo"
              @keydown="onScanKeydown"
              @blur="onScanBlur"
              @focus="onScanFocus"
            >
            <span
              class="pos-scan-status"
              :class="scanFocused ? 'pos-scan-status--ready' : 'pos-scan-status--idle'"
            >
              {{ scanFocused ? 'Lector listo' : 'Toca aquí para escanear' }}
            </span>
          </div>
        </label>

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
          Carrito vacío. Escanea un reloj o agrégalo desde el catálogo.
        </div>

        <ul v-else class="pos-cart">
          <li v-for="line in cart" :key="line.watchId" class="pos-cart__line">
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
                Agotado
              </span>
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
                {{ formatCop(line.retailPrice * line.quantity) }}
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

        <div class="pos-cart__footer">
          <strong>Total {{ formatCop(subtotal) }}</strong>
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
        <h2 class="admin-record-title">Catálogo</h2>
        <PosCatalog
          ref="catalogRef"
          :cart-qty-by-id="cartQtyById"
          @add="upsertWatch($event, 1)"
          @preview-closed="focusScanner"
        />
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
            <span>Teléfono</span>
            <UiLuxInput
              v-model="customer.phone"
              placeholder="Teléfono"
              @input="onCustomerInput"
            />
          </label>
          <label class="pos-field">
            <span>Documento</span>
            <UiLuxInput v-model="customer.document" placeholder="Documento" />
          </label>
          <label class="pos-field">
            <span>Email</span>
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
              Pagos {{ formatCop(paymentsSum) }} / {{ formatCop(subtotal) }}
              <span v-if="changePreview">
                · Cambio {{ formatCop(changePreview) }}
              </span>
            </p>
            <p
              v-if="paymentDiff !== 0 && subtotal > 0"
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
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pos-page.admin-records-page {
  max-width: min(1600px, 100%);
}

.pos-layout {
  display: grid;
  gap: 1rem;
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

.pos-cart__line {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 48px 1fr auto auto;
  align-items: center;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
  padding-bottom: 0.65rem;
}

.pos-cart__thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: #fff;
  border-radius: 4px;
}

.pos-cart__thumb--empty {
  background: rgba(255, 255, 255, 0.08);
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
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pos-cart__side {
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

@media (min-width: 1100px) {
  .pos-layout {
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.8fr) minmax(280px, 1fr);
    align-items: start;
  }
}

@media (max-width: 700px) {
  .pos-cart__line {
    grid-template-columns: 48px 1fr;
  }

  .pos-cart__qty,
  .pos-cart__side {
    grid-column: 1 / -1;
  }
}
</style>
