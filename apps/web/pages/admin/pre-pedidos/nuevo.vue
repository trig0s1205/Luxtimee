<script setup lang="ts">
import type {
  CreateManualPreOrderDto,
  CustomerOrderHintDto,
  PaginatedResponse,
  ShippingZoneDto,
  WatchStaffDto,
} from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
useSeoMeta({ title: 'Nuevo pre-pedido — LUXTIMEE Admin' });

const api = useApi();
const toast = useToast();
const router = useRouter();

type ManualLine = {
  watchId: string;
  label: string;
  stock: number;
  retailPrice: number;
  quantity: number;
  deliveryNote: string;
};

const form = reactive({
  customerName: '',
  customerAddress: '',
  customerPhone: '',
  shippingZoneId: '',
});

const lines = ref<ManualLine[]>([]);
const watchSearch = ref('');
const loading = ref(false);
const hintLoading = ref(false);
const error = ref('');

const { data: zones } = await useAsyncData('admin-shipping-zones', () =>
  api.get<ShippingZoneDto[]>('/shipping-zones').catch(() => []),
);

const shippingCost = computed(() => {
  const zone = zones.value?.find((z) => z.id === form.shippingZoneId);
  return zone?.cost ?? 0;
});

const subtotal = computed(() =>
  lines.value.reduce((sum, line) => sum + line.retailPrice * line.quantity, 0),
);
const total = computed(() => subtotal.value + shippingCost.value);
const depositExpected = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0) * 10_000);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
const searchResults = ref<WatchStaffDto[]>([]);
const searchPending = ref(false);

function scheduleWatchSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runWatchSearch, 300);
}

async function runWatchSearch() {
  const term = watchSearch.value.trim();
  if (term.length < 2) {
    searchResults.value = [];
    return;
  }
  searchPending.value = true;
  try {
    const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
      search: term,
      page: 1,
      limit: 8,
    });
    searchResults.value = res.data;
  } catch {
    searchResults.value = [];
  } finally {
    searchPending.value = false;
  }
}

function addWatch(watch: WatchStaffDto) {
  const existing = lines.value.find((line) => line.watchId === watch.id);
  if (existing) {
    if (existing.quantity < watch.stock) existing.quantity += 1;
    else toast.error('Stock insuficiente');
    return;
  }
  if ((watch.stock ?? 0) <= 0) {
    toast.error('Sin stock disponible');
    return;
  }
  lines.value.push({
    watchId: watch.id,
    label: `${watch.brand.name} ${watch.model}`,
    stock: watch.stock ?? 0,
    retailPrice: watch.retailPrice,
    quantity: 1,
    deliveryNote: '',
  });
  watchSearch.value = '';
  searchResults.value = [];
}

function removeLine(watchId: string) {
  lines.value = lines.value.filter((line) => line.watchId !== watchId);
}

async function loadCustomerHint() {
  const phone = form.customerPhone.trim();
  if (phone.length < 7) return;
  hintLoading.value = true;
  try {
    const hint = await api.get<CustomerOrderHintDto | null>('/pre-orders/customer-hint', { phone });
    if (!hint) return;
    form.customerName = hint.customerName;
    form.customerAddress = hint.customerAddress;
    if (hint.shippingZoneId) form.shippingZoneId = hint.shippingZoneId;
    toast.success('Datos del cliente cargados');
  } catch {
    /* sin historial */
  } finally {
    hintLoading.value = false;
  }
}

async function submit() {
  error.value = '';
  if (!lines.value.length) {
    error.value = 'Agrega al menos un reloj';
    return;
  }
  if (!form.customerName.trim() || !form.customerAddress.trim() || !form.shippingZoneId) {
    error.value = 'Completa nombre, dirección y zona de envío';
    return;
  }

  loading.value = true;
  try {
    const payload: CreateManualPreOrderDto = {
      customerName: form.customerName.trim(),
      customerAddress: form.customerAddress.trim(),
      customerPhone: form.customerPhone.trim() || undefined,
      shippingZoneId: form.shippingZoneId,
      items: lines.value.map((line) => ({
        watchId: line.watchId,
        quantity: line.quantity,
        deliveryNote: line.deliveryNote.trim() || undefined,
      })),
    };
    await api.post('/pre-orders/manual', payload);
    toast.success('Pre-pedido creado');
    await router.push('/admin/pre-pedidos/activos');
  } catch (e: unknown) {
    error.value = extractApiErrorMessage(e, 'No se pudo crear el pre-pedido');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="admin-records-page max-w-3xl">
    <UiSectionHeader label="Pre-pedidos" title="Nuevo pre-pedido manual" />
    <p class="admin-records-hint">
      Registra pedidos que llegan por WhatsApp. El cliente no necesita entrar a la web.
    </p>

    <form class="space-y-5 mt-6" @submit.prevent="submit">
      <div class="admin-record-card p-5 space-y-4">
        <h3 class="admin-record-title">Cliente</h3>
        <UiLuxInput v-model="form.customerPhone" placeholder="Teléfono / WhatsApp" @blur="loadCustomerHint" />
        <button
          v-if="form.customerPhone.trim().length >= 7"
          type="button"
          class="admin-record-btn admin-record-btn--ghost"
          :disabled="hintLoading"
          @click="loadCustomerHint"
        >
          {{ hintLoading ? 'Buscando...' : 'Buscar datos por teléfono' }}
        </button>
        <UiLuxInput v-model="form.customerName" placeholder="Nombre completo" required />
        <UiLuxInput v-model="form.customerAddress" placeholder="Dirección de entrega" required />
        <label class="block text-xs uppercase tracking-widest text-lux-white-dim" for="manual-shipping">Zona / barrio</label>
        <select
          id="manual-shipping"
          v-model="form.shippingZoneId"
          required
          class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
        >
          <option value="" disabled>Seleccione zona</option>
          <option v-for="zone in zones" :key="zone.id" :value="zone.id">
            {{ zone.name }} — {{ formatCop(zone.cost) }}
          </option>
        </select>
      </div>

      <div class="admin-record-card p-5 space-y-4">
        <h3 class="admin-record-title">Relojes</h3>
        <UiLuxInput
          v-model="watchSearch"
          placeholder="Buscar por marca, modelo o SKU..."
          @input="scheduleWatchSearch"
        />
        <div v-if="searchPending" class="admin-record-muted text-sm">Buscando...</div>
        <ul v-if="searchResults.length" class="admin-record-list border border-lux-gold/15">
          <li v-for="watch in searchResults" :key="watch.id">
            <button type="button" class="admin-record-btn admin-record-btn--ghost w-full justify-start" @click="addWatch(watch)">
              {{ watch.brand.name }} {{ watch.model }} · {{ formatCop(watch.retailPrice) }} · Stock {{ watch.stock }}
            </button>
          </li>
        </ul>

        <div v-if="!lines.length" class="admin-record-empty">Agrega relojes desde el buscador.</div>
        <div v-for="line in lines" :key="line.watchId" class="border border-lux-gold/15 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="admin-record-title">{{ line.label }}</p>
              <p class="admin-record-muted">{{ formatCop(line.retailPrice) }} · Stock {{ line.stock }}</p>
            </div>
            <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="removeLine(line.watchId)">
              Quitar
            </button>
          </div>
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Cantidad</label>
          <input
            v-model.number="line.quantity"
            type="number"
            min="1"
            :max="line.stock"
            class="w-24 bg-lux-black-2 border border-lux-gold/20 px-3 py-2 text-sm"
          >
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Nota de entrega (opcional)</label>
          <textarea
            v-model="line.deliveryNote"
            rows="2"
            maxlength="500"
            placeholder="Ej: recoger a las 6pm, dejar en portería..."
            class="admin-record-textarea"
          />
        </div>
      </div>

      <div class="admin-record-card p-5 space-y-2 text-sm">
        <p>Subtotal: {{ formatCop(subtotal) }}</p>
        <p>Envío: {{ formatCop(shippingCost) }}</p>
        <p class="admin-record-title">Total: {{ formatCop(total) }}</p>
        <p class="admin-record-muted">Abono esperado: {{ formatCop(depositExpected) }}</p>
      </div>

      <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

      <div class="admin-record-actions">
        <button type="submit" class="admin-record-btn admin-record-btn--primary" :disabled="loading">
          {{ loading ? 'Guardando...' : 'Crear pre-pedido' }}
        </button>
        <NuxtLink to="/admin/pre-pedidos/activos" class="admin-record-btn admin-record-btn--ghost">
          Cancelar
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
