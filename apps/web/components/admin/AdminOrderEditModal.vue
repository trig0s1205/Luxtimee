<script setup lang="ts">
import type { OrderDto } from '@luxtime/shared';
import { ORDER_STATUS_LABELS } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { extractApiErrorMessage } from '~/utils/api-error';

const props = defineProps<{ order: OrderDto }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const api = useApi();
const toast = useToast();

const saving = ref(false);
const error = ref('');

const form = reactive({
  customerAddress: props.order.customerAddress,
  shippingCost: props.order.shippingCost,
  status: props.order.status ?? '',
});

const statusOptions = Object.entries(ORDER_STATUS_LABELS) as [string, string][];

const totalPreview = computed(() => props.order.subtotal + form.shippingCost);

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const payload: Record<string, unknown> = {};
    if (form.customerAddress !== props.order.customerAddress) payload.customerAddress = form.customerAddress;
    if (form.shippingCost !== props.order.shippingCost) payload.shippingCost = form.shippingCost;
    if (form.status && form.status !== (props.order.status ?? '')) payload.status = form.status;

    if (!Object.keys(payload).length) {
      emit('close');
      return;
    }

    await api.patch(`/orders/${props.order.id}`, payload);
    toast.success('Pedido actualizado');
    emit('saved');
  } catch (e: unknown) {
    error.value = extractApiErrorMessage(e, 'No se pudo actualizar el pedido.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin-modal-overlay" @click.self="emit('close')">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h2 class="admin-record-title">Editar pedido</h2>
        <button type="button" class="admin-modal-close" aria-label="Cerrar" @click="emit('close')">✕</button>
      </div>

      <div class="admin-modal-body space-y-5">
        <div class="admin-record-muted text-sm">
          <p>Cliente: {{ order.customerName }}</p>
          <p>Subtotal: {{ formatCop(order.subtotal) }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Estado</label>
          <select
            v-model="form.status"
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
          >
            <option value="">Sin estado</option>
            <option v-for="[key, label] in statusOptions" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
          <p v-if="form.status === 'CANCELADO' && order.status !== 'CANCELADO'" class="text-amber-400 text-xs">
            ⚠ Si el pedido estaba pagado, el inventario se restaurará automáticamente.
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Dirección de entrega</label>
          <UiLuxInput v-model="form.customerAddress" placeholder="Dirección de entrega" />
        </div>

        <div class="space-y-2">
          <label class="text-xs uppercase tracking-widest text-lux-white-dim">Costo de envío (COP)</label>
          <input
            v-model.number="form.shippingCost"
            type="number"
            min="0"
            step="1000"
            class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
          />
          <p class="admin-record-muted text-xs">Total estimado: {{ formatCop(totalPreview) }}</p>
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
  background: var(--lux-black-2);
  border: 1px solid rgba(212, 175, 55, 0.2);
  width: 100%;
  max-width: 480px;
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
.space-y-2 > * + * { margin-top: 0.5rem; }
</style>
