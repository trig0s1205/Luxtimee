<script setup lang="ts">
import type { CreateShippingZoneDto, ShippingZoneDto } from '@luxtime/shared';
import { isAlwaysFreeShippingZone } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { invalidateAdminCache } from '~/utils/admin-cache';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const { data: zones, refresh, pending } = useAdminCachedData('admin-zones', () =>
  api.get<ShippingZoneDto[]>('/shipping-zones').catch(() => []),
);

const newZone = reactive<CreateShippingZoneDto>({
  name: '',
  cost: 0,
  isNational: false,
});

const creating = ref(false);
const deletingId = ref<string | null>(null);

async function save(zone: ShippingZoneDto, cost: number) {
  await api.patch(`/shipping-zones/${zone.id}`, { cost });
  invalidateAdminCache('admin-zones');
  await refresh();
}

async function createZone() {
  if (!newZone.name.trim()) {
    toast.warning('Ingresa el nombre del lugar.');
    return;
  }
  if (!Number.isFinite(newZone.cost) || newZone.cost < 0) {
    toast.warning('Ingresa un precio válido.');
    return;
  }

  creating.value = true;
  try {
    await api.post('/shipping-zones', {
      name: newZone.name.trim(),
      cost: Number(newZone.cost),
      isNational: newZone.isNational,
    });
    newZone.name = '';
    newZone.cost = 0;
    newZone.isNational = false;
    toast.success('Zona de envío creada.');
    invalidateAdminCache('admin-zones');
    await refresh();
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'No se pudo crear la zona.';
    toast.error(message);
  } finally {
    creating.value = false;
  }
}

async function removeZone(zone: ShippingZoneDto) {
  const ok = await confirm({
    title: `¿Eliminar ${zone.name}?`,
    message: 'Solo se puede eliminar si no hay pedidos asociados.',
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;

  deletingId.value = zone.id;
  try {
    await api.del(`/shipping-zones/${zone.id}`);
    toast.success('Zona eliminada.');
    invalidateAdminCache('admin-zones');
    await refresh();
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'No se pudo eliminar la zona.';
    toast.error(message);
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <div>
    <UiToastContainer />
    <UiSectionHeader
      label="Operaciones"
      title="Tarifas de envío"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />

    <section class="shipping-create-card">
      <h3>Nueva zona de envío</h3>
      <div class="shipping-create-form">
        <UiLuxInput v-model="newZone.name" placeholder="Nombre del lugar (ej. Medellín centro)" />
        <UiLuxInput v-model.number="newZone.cost" type="number" min="0" placeholder="Precio COP" />
        <label class="shipping-national-check">
          <input v-model="newZone.isNational" type="checkbox">
          Envío nacional
        </label>
        <UiLuxButton :disabled="creating" @click="createZone">
          {{ creating ? 'Creando...' : 'Agregar zona' }}
        </UiLuxButton>
      </div>
    </section>

    <div class="shipping-zones-list">
      <div v-for="zone in zones" :key="zone.id" class="shipping-zone-row">
        <div class="shipping-zone-info">
          <p class="font-display">{{ zone.name }}</p>
          <p class="shipping-zone-type">{{ zone.isNational ? 'Nacional' : 'Metropolitana' }}</p>
        </div>
        <input
          v-if="!zone.alwaysFree && !isAlwaysFreeShippingZone(zone.name)"
          type="number"
          class="shipping-zone-input"
          :value="zone.cost"
          @change="save(zone, Number(($event.target as HTMLInputElement).value))"
        >
        <span v-else class="shipping-zone-free">Gratis (fijo)</span>
        <span class="shipping-zone-price">
          {{ zone.alwaysFree || isAlwaysFreeShippingZone(zone.name) ? 'Gratis' : formatCop(zone.cost) }}
        </span>
        <button
          v-if="!zone.alwaysFree && !isAlwaysFreeShippingZone(zone.name)"
          type="button"
          class="shipping-zone-delete"
          :disabled="deletingId === zone.id"
          @click="removeZone(zone)"
        >
          {{ deletingId === zone.id ? '...' : 'Eliminar' }}
        </button>
      </div>
      <p v-if="!zones?.length" class="shipping-zone-empty">No hay zonas configuradas.</p>
    </div>
  </div>
</template>

<style scoped>
.shipping-create-card {
  margin-bottom: 24px;
  padding: 20px;
  border: var(--border-hairline);
  background: rgba(255, 255, 255, 0.02);
  max-width: 42rem;
}

.shipping-create-card h3 {
  margin: 0 0 14px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.shipping-create-form {
  display: grid;
  gap: 12px;
}

.shipping-national-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--lux-white-dim);
}

.shipping-zones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 42rem;
}

.shipping-zone-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: var(--border-hairline);
  background: rgba(255, 255, 255, 0.02);
}

.shipping-zone-info {
  flex: 1;
}

.shipping-zone-type {
  font-size: 12px;
  color: var(--lux-white-dim);
}

.shipping-zone-input {
  width: 8rem;
  background: transparent;
  border: var(--border-hairline);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--lux-white);
  outline: none;
}

.shipping-zone-input:focus {
  border-color: rgba(200, 169, 110, 0.22);
}

.shipping-zone-free {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white);
  min-width: 8rem;
}

.shipping-zone-price {
  font-size: 12px;
  color: var(--lux-white-dim);
  min-width: 5rem;
}

.shipping-zone-delete {
  border: 1px solid rgba(232, 93, 93, 0.35);
  background: transparent;
  color: #e85d5d;
  padding: 8px 12px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.shipping-zone-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shipping-zone-empty {
  color: var(--lux-white-dim);
  font-size: 13px;
}
</style>



