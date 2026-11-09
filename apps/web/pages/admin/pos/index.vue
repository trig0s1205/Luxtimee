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
const catalogRef = ref<{ reload: () => Promise<void> } | null>(null);

const scanInput = ref('');
const scanBusy = ref(false);
const scanEl = ref<HTMLInputElement | null>(null);
const detector = createScanDetector();
const holdScannerFocus = ref(true);

const manualSearch = ref('');
const manualBusy = ref(false);
const manualHits = ref<PosWatchDto[]>([]);
let manualTimer: ReturnType<typeof setTimeout> | null = null;

const cart = ref<CartLine[]>([]);
const customer = reactive({
  name: 'Cliente de mostrador',
  document: '',
  phone: '',
  email: '',
});
const customerHints = ref<PosCustomerHintDto[]>([]);
const note = ref('');
const payments = ref<PaymentDraft[]>([
  {
    id: 'p1',
    method: 'EFECTIVO',
    amount: null,
    cashReceived: null,
    reference: '',
    proofUrl: '',
    approvalCode: '',
    cardLast4: '',
  },
]);
const selling = ref(false);
const lastSale = ref<PosSaleResultDto | null>(null);
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

function focusScanner() {
  if (!holdScannerFocus.value) return;
  nextTick(() => scanEl.value?.focus());
}

function onScanBlur() {
  window.setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      active !== scanEl.value &&
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(active.tagName)
    ) {
      return;
    }
    focusScanner();
  }, 0);
}

function onManualSearchInput() {
  if (manualTimer) clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    void runManualSearch();
  }, 250);
}

async function runManualSearch() {
  const q = manualSearch.value.trim();
  if (q.length < 2) {
    manualHits.value = [];
    return;
  }
  manualBusy.value = true;
  try {
    manualHits.value = await api.get<PosWatchDto[]>('/pos/watches', {
      search: q,
    });
  } catch (err: unknown) {
    manualHits.value = [];
    toast.error(extractApiErrorMessage(err, 'No se pudo buscar.'));
  } finally {
    manualBusy.value = false;
  }
}

function addManualHit(watch: PosWatchDto) {
  upsertWatch(watch, 1);
  manualSearch.value = '';
  manualHits.value = [];
  focusScanner();
}

function upsertWatch(watch: PosWatchDto, qty = 1) {
  const existing = cart.value.find((line) => line.watchId === watch.id);
  if (existing) {
    if (existing.quantity + qty > watch.stock) {
      playBeep('error');
      toast.warning('No hay más unidades disponibles.');
      return;
    }
    existing.quantity += qty;
    existing.stock = watch.stock;
  } else {
    if (watch.stock < qty) {
      playBeep('error');
      toast.warning('Sin stock suficiente.');
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
      quantity: qty,
    });
  }
  playBeep('ok');
}

async function resolveCode(raw: string) {
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
    toast.error(extractApiErrorMessage(err, 'Código no encontrado.'));
  } finally {
    scanBusy.value = false;
    scanInput.value = '';
    focusScanner();
  }
}

async function onScanEnter() {
  const text = scanInput.value.trim();
  if (!text) return;
  if (looksLikeSku(text) || text.length >= 3) {
    await resolveCode(text);
    return;
  }
  toast.warning('Ingresa un SKU válido.');
}

function onScanKeydown(event: KeyboardEvent) {
  const result = detector.push(event.key, performance.now());
  if (!result) return;
  if (result.type === 'scan') {
    event.preventDefault();
    void resolveCode(result.code);
  }
}

function setQty(line: CartLine, next: number) {
  if (next <= 0) {
    cart.value = cart.value.filter((item) => item.watchId !== line.watchId);
    return;
  }
  if (next > line.stock) {
    toast.warning('Supera el stock disponible.');
    return;
  }
  line.quantity = next;
}

function clearCart() {
  cart.value = [];
  payments.value = [
    {
      id: `p${Date.now()}`,
      method: 'EFECTIVO',
      amount: null,
      cashReceived: null,
      reference: '',
      proofUrl: '',
      approvalCode: '',
      cardLast4: '',
    },
  ];
  note.value = '';
  customer.name = 'Cliente de mostrador';
  customer.document = '';
  customer.phone = '';
  customer.email = '';
  customerHints.value = [];
}

function addPayment() {
  if (payments.value.length >= 4) return;
  payments.value.push({
    id: `p${Date.now()}`,
    method: 'TRANSFERENCIA',
    amount: null,
    cashReceived: null,
    reference: '',
    proofUrl: '',
    approvalCode: '',
    cardLast4: '',
  });
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
  if (!cart.value.length) {
    toast.warning('Agrega al menos un reloj.');
    return;
  }
  if (cart.value.some((line) => line.quantity > line.stock)) {
    toast.warning('Hay líneas sin stock suficiente.');
    return;
  }
  if (!customer.name.trim()) {
    toast.warning('El nombre del cliente es obligatorio.');
    return;
  }
  if (paymentsSum.value !== subtotal.value) {
    toast.warning('La suma de pagos debe coincidir con el total.');
    return;
  }
  for (const p of payments.value) {
    const amount = Number(p.amount) || 0;
    if (amount <= 0) {
      toast.warning('Cada pago debe tener un monto mayor a 0.');
      return;
    }
    if (p.method === 'EFECTIVO') {
      const received = Number(p.cashReceived) || 0;
      if (received < amount) {
        toast.warning('El efectivo recibido debe cubrir el monto.');
        return;
      }
    }
    if (p.method === 'TRANSFERENCIA' && !p.reference.trim() && !p.proofUrl) {
      toast.warning('Transferencia: referencia o comprobante requerido.');
      return;
    }
    if (p.method === 'DATAFONO_BOLD' && !/^\d{4,12}$/.test(p.approvalCode.trim())) {
      toast.warning('Ingresa el número de aprobación del datáfono.');
      return;
    }
  }

  selling.value = true;
  lastSale.value = null;
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
        reference: p.method === 'TRANSFERENCIA' ? p.reference || undefined : undefined,
        proofUrl: p.proofUrl || undefined,
        approvalCode:
          p.method === 'DATAFONO_BOLD' ? p.approvalCode || undefined : undefined,
        cardLast4:
          p.method === 'DATAFONO_BOLD' ? p.cardLast4 || undefined : undefined,
      })),
      note: note.value.trim() || undefined,
    });
    lastSale.value = result;
    playBeep('ok');
    toast.success(`Venta ${result.readableId} registrada.`);
    clearCart();
    await catalogRef.value?.reload();
    focusScanner();
  } catch (err: unknown) {
    playBeep('error');
    toast.error(extractApiErrorMessage(err, 'No se pudo registrar la venta.'));
  } finally {
    selling.value = false;
  }
}

onMounted(() => focusScanner());
onBeforeUnmount(() => {
  if (hintTimer) clearTimeout(hintTimer);
  if (manualTimer) clearTimeout(manualTimer);
});
</script>

<template>
  <div class="admin-records-page pos-page">
    <UiSectionHeader label="Punto de venta" title="POS" />

    <div v-if="lastSale" class="pos-success admin-record-card p-4">
      <div>
        <p class="admin-record-title">Venta {{ lastSale.readableId }}</p>
        <p class="admin-record-muted">
          Comprobante {{ lastSale.receiptNumber }} · Total {{ formatCop(lastSale.total) }}
          <span v-if="lastSale.changeTotal">
            · Cambio {{ formatCop(lastSale.changeTotal) }}
          </span>
        </p>
      </div>
      <button
        type="button"
        class="admin-record-btn admin-record-btn--primary"
        @click="openReceipt(lastSale.receiptId)"
      >
        Descargar comprobante
      </button>
    </div>

    <div class="pos-layout">
      <section class="pos-zone admin-record-card p-4">
        <h2 class="admin-record-title">Escáner y carrito</h2>
        <label class="pos-field">
          <span>SKU / código de barras</span>
          <input
            ref="scanEl"
            v-model="scanInput"
            class="admin-input"
            type="text"
            autocomplete="off"
            :disabled="scanBusy"
            placeholder="Escanea o escribe y Enter"
            @keydown="onScanKeydown"
            @keydown.enter.prevent="onScanEnter"
            @blur="onScanBlur"
            @focus="holdScannerFocus = true"
          >
        </label>

        <label class="pos-field">
          <span>Búsqueda manual</span>
          <UiLuxInput
            v-model="manualSearch"
            placeholder="SKU, marca o modelo"
            @input="onManualSearchInput"
            @focus="holdScannerFocus = false"
            @blur="holdScannerFocus = true; focusScanner()"
          />
        </label>
        <ul v-if="manualHits.length" class="pos-hints">
          <li v-for="hit in manualHits" :key="hit.id">
            <button type="button" @click="addManualHit(hit)">
              {{ hit.brandName }} {{ hit.model }} · {{ hit.sku }} ·
              {{ formatCop(hit.retailPrice) }} · stock {{ hit.stock }}
            </button>
          </li>
        </ul>
        <p v-else-if="manualBusy" class="admin-record-muted">Buscando…</p>

        <div v-if="!cart.length" class="admin-record-empty">
          Carrito vacío. Escanea un reloj o agrégalo desde el catálogo.
        </div>

        <ul v-else class="pos-cart">
          <li v-for="line in cart" :key="line.watchId" class="pos-cart__line">
            <div class="pos-cart__main">
              <p class="pos-cart__name">{{ line.brandName }} {{ line.model }}</p>
              <p class="pos-cart__sku">{{ line.sku }}</p>
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
              <button type="button" class="admin-btn" @click="setQty(line, line.quantity - 1)">−</button>
              <span>{{ line.quantity }}</span>
              <button type="button" class="admin-btn" @click="setQty(line, line.quantity + 1)">+</button>
            </div>
            <p class="pos-cart__line-total">
              {{ formatCop(line.retailPrice * line.quantity) }}
            </p>
          </li>
        </ul>

        <div class="pos-cart__footer">
          <strong>Total {{ formatCop(subtotal) }}</strong>
          <button
            v-if="cart.length"
            type="button"
            class="admin-record-btn admin-record-btn--ghost"
            @click="clearCart"
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
        />
      </section>

      <section class="pos-zone admin-record-card p-4">
        <h2 class="admin-record-title">Cliente y pagos</h2>

        <div class="pos-customer" @focusin="holdScannerFocus = false" @focusout="holdScannerFocus = true; focusScanner()">
          <label class="pos-field">
            <span>Nombre</span>
            <UiLuxInput v-model="customer.name" placeholder="Nombre del cliente" required @input="onCustomerInput" />
          </label>
          <label class="pos-field">
            <span>Teléfono</span>
            <UiLuxInput v-model="customer.phone" placeholder="Teléfono" @input="onCustomerInput" />
          </label>
          <label class="pos-field">
            <span>Documento</span>
            <UiLuxInput v-model="customer.document" placeholder="Documento" />
          </label>
          <label class="pos-field">
            <span>Email</span>
            <UiLuxInput v-model="customer.email" type="email" placeholder="Email" />
          </label>
          <ul v-if="customerHints.length" class="pos-hints">
            <li v-for="hint in customerHints" :key="`${hint.customerPhone}-${hint.customerName}`">
              <button type="button" @click="applyHint(hint)">
                {{ hint.customerName }} · {{ hint.customerPhone }}
              </button>
            </li>
          </ul>
        </div>

        <div
          class="pos-payments"
          @focusin="holdScannerFocus = false"
          @focusout="holdScannerFocus = true; focusScanner()"
        >
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
              <button type="button" class="admin-link-btn" @click="fillRemaining(payment)">
                Completar
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
                      (Number(payment.cashReceived) || 0) - (Number(payment.amount) || 0),
                    ),
                  )
                }}
              </span>
            </div>

            <div v-else-if="payment.method === 'TRANSFERENCIA'" class="pos-payment__row">
              <input
                v-model="payment.reference"
                class="admin-input"
                placeholder="Referencia"
                maxlength="80"
              >
              <label class="admin-record-btn admin-record-btn--ghost">
                {{ payment.uploading ? 'Subiendo…' : payment.proofUrl ? 'Comprobante OK' : 'Subir comprobante' }}
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
          <textarea v-model="note" class="admin-record-textarea" rows="2" maxlength="300" />
        </label>

        <div class="pos-checkout">
          <p>
            Pagos {{ formatCop(paymentsSum) }} / {{ formatCop(subtotal) }}
            <span v-if="changePreview"> · Cambio {{ formatCop(changePreview) }}</span>
          </p>
          <button
            type="button"
            class="admin-record-btn admin-record-btn--primary"
            :disabled="selling || !cart.length"
            @click="submitSale"
          >
            {{ selling ? 'Registrando…' : 'Cobrar' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
  grid-template-columns: 1fr auto auto;
  align-items: center;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
  padding-bottom: 0.65rem;
}

.pos-cart__name {
  margin: 0;
  font-weight: 700;
}

.pos-cart__sku,
.pos-cart__price {
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

.pos-cart__footer,
.pos-checkout,
.pos-success {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
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

@media (min-width: 1100px) {
  .pos-layout {
    grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.4fr) minmax(300px, 1fr);
    align-items: start;
  }
}
</style>
