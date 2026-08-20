<script setup lang="ts">
import type { OrderDto, PaginatedResponse, ShippingZoneDto, WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';

const props = defineProps<{ order: OrderDto }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const api = useApi();
const toast = useToast();

type Line = {
  watchId: string;
  label: string;
  stock: number;
  quantity: number;
  deliveryNote: string;
};

const saving = ref(false);
const error = ref('');
const watchSearch = ref('');
const searchResults = ref<WatchStaffDto[]>([]);
const searchPending = ref(false);

const { data: zones } = useAdminCachedData('admin-zones', () =>
  api.get<ShippingZoneDto[]>('/shipping-zones').catch(() => []),
);

const selectedZoneId = ref(props.order.shippingZoneId ?? '');
const selectedZone = computed(() => zones.value?.find((z) => z.id === selectedZoneId.value) ?? null);
const isManualCostZone = computed(() => !!selectedZone.value?.isManualCost);
const manualShippingCost = ref(
  selectedZone.value?.isManualCost ? props.order.shippingCost : 0,
);

const lines = ref<Line[]>(
  props.order.items.map((item) => ({
    watchId: item.watchId,
    label: item.productName,
    stock: 99,
    quantity: item.quantity,
    deliveryNote: item.deliveryNote ?? '',
  })),
);

watch(selectedZoneId, () => {
  manualShippingCost.value = 0;
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  const term = watchSearch.value.trim();
  if (term.length < 2) { searchResults.value = []; return; }
  searchPending.value = true;
  try {
    const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', { search: term, page: 1, limit: 8 });
    searchResults.value = res.data;
  } catch {
    searchResults.value = [];
  } finally {
    searchPending.value = false;
  }
}

function addWatch(watch: WatchStaffDto) {
  const existing = lines.value.find((l) => l.watchId === watch.id);
  if (existing) {
    if (existing.quantity < watch.stock) existing.quantity += 1;
    else toast.error('Stock insuficiente');
    return;
  }
  lines.value.push({
    watchId: watch.id,
    label: `${watch.brand.name} ${watch.model}`,
    stock: watch.stock ?? 0,
    quantity: 1,
    deliveryNote: '',
  });
  watchSearch.value = '';
  searchResults.value = [];
}

function removeLine(watchId: string) {
  lines.value = lines.value.filter((l) => l.watchId !== watchId);
}

function stockWarning(line: Line) {
  return line.stock > 0 && line.quantity > line.stock;
}

async function save() {
  if (!lines.value.length) { error.value = 'Agrega al menos un reloj'; return; }
  saving.value = true;
  error.value = '';
  try {
    await api.patch(`/pre-orders/${props.order.id}`, {
      ...(selectedZoneId.value ? { shippingZoneId: selectedZoneId.value } : {}),
      ...(isManualCostZone.value ? { manualShippingCost: manualShippingCost.value } : {}),
      items: lines.value.map((l) => ({
        watchId: l.watchId,
        quantity: l.quantity,
        deliveryNote: l.deliveryNote.trim() || undefined,
      })),
    });
    toast.success('Pre-pedido actualizado');
    emit('saved');
  } catch (e: unknown) {
    error.value = extractApiErrorMessage(e, 'No se pudo actualizar el pre-pedido.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin-modal-overlay" @click.self="emit('close')">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h2 class="admin-record-title">Editar pre-pedido {{ order.readableId }}</h2>
        <button type="button" class="admin-modal-close" aria-label="Cerrar" @click="emit('close')">✕</button>
      </div>

      <div class="admin-modal-body space-y-5">
        <div class="space-y-3">
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Zona de envío</label>
          <select
            v-model="selectedZoneId"
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
          >
            <option value="">Sin zona</option>
            <option v-for="zone in zones" :key="zone.id" :value="zone.id">
              {{ zone.name }}{{ zone.isManualCost ? ' — Costo manual' : ` — ${formatCop(zone.cost)}` }}
            </option>
          </select>
          <div v-if="isManualCostZone" class="space-y-1">
            <label class="text-xs uppercase tracking-widest text-lux-white-dim">Costo de envío (COP)</label>
            <input
              v-model.number="manualShippingCost"
              type="number"
              min="0"
              step="1000"
              class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div class="space-y-3">
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Relojes</label>
          <UiLuxInput
            v-model="watchSearch"
            placeholder="Buscar por marca, modelo o SKU..."
            @input="scheduleSearch"
          />
          <div v-if="searchPending" class="admin-record-muted text-sm">Buscando...</div>
          <ul v-if="searchResults.length" class="admin-record-list border border-lux-gold/15">
            <li v-for="watch in searchResults" :key="watch.id">
              <button
                type="button"
                class="admin-record-btn admin-record-btn--ghost w-full justify-start"
                @click="addWatch(watch)"
              >
                {{ watch.brand.name }} {{ watch.model }} · {{ formatCop(watch.retailPrice) }} · Stock {{ watch.stock }}
              </button>
            </li>
          </ul>

          <div v-if="!lines.length" class="admin-record-empty">Agrega relojes desde el buscador.</div>
          <div v-for="line in lines" :key="line.watchId" class="border border-lux-gold/15 p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="admin-record-title">{{ line.label }}</p>
                <p v-if="stockWarning(line)" class="text-amber-400 text-xs mt-1">
                  ⚠ Stock disponible: {{ line.stock }} — cantidad supera el stock
                </p>
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
              class="w-24 bg-lux-black-2 border border-lux-gold/20 px-3 py-2 text-sm"
            />
            <label class="text-xs uppercase tracking-widest text-lux-white-dim">Nota de entrega (opcional)</label>
            <textarea
              v-model="line.deliveryNote"
              rows="2"
              maxlength="500"
              class="admin-record-textarea"
            />
          </div>
        </div>

        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
      </div>

      <div class="admin-modal-footer admin-record-actions">
        <button
          type="button"
          class="admin-record-btn admin-record-btn--primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="emit('close')">
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.admin-modal {
  background: var(--color-lux-black-2, #111);
  border: 1px solid rgba(212, 175, 55, 0.2);
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.admin-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
}

.admin-modal-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.6;
  padding: 0.25rem;
}

.admin-modal-close:hover {
  opacity: 1;
}

.admin-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.admin-modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(212, 175, 55, 0.1);
}

.space-y-5 > * + * { margin-top: 1.25rem; }
.space-y-3 > * + * { margin-top: 0.75rem; }
.space-y-1 > * + * { margin-top: 0.25rem; }
</style>
