<script setup lang="ts">
import type { WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();

if (!auth.loaded) await auth.fetchMe();
if (!auth.isSuperAdmin) throw createError({ statusCode: 403, message: 'Solo Super Admin' });

const costDrafts = reactive<Record<string, string>>({});
const savingId = ref<string | null>(null);

const { data: watches, refresh, pending } = await useAsyncData('pending-cost-watches', () =>
  api.get<WatchStaffDto[]>('/watches/pending-cost').catch(() => []),
);

async function saveCost(watch: WatchStaffDto) {
  const raw = costDrafts[watch.id];
  const cost = Number(raw);
  if (!Number.isFinite(cost) || cost <= 0) {
    toast.warning('Ingresa un costo mayor a 0 en COP.');
    return;
  }

  savingId.value = watch.id;
  try {
    await api.patch(`/watches/${watch.id}`, { cost });
    toast.success('Costo asignado correctamente.');
    delete costDrafts[watch.id];
    await refresh();
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Error al guardar el costo.';
    toast.error(message);
  } finally {
    savingId.value = null;
  }
}

useSeoMeta({ title: 'Relojes pendientes de costo — Luxtime Admin' });
</script>

<template>
  <div class="pending-costs">
    <UiToastContainer />
    <UiSectionHeader label="Finanzas" title="Relojes pendientes de costo" />
    <p class="pending-costs-intro">
      Relojes sin costo asignado (vacío o en 0). Al guardar un costo mayor a 0 se calculan los márgenes automáticamente.
    </p>

    <div v-if="pending" class="pending-costs-empty">Cargando...</div>
    <div v-else-if="!watches?.length" class="pending-costs-empty">No hay relojes pendientes de costo.</div>

    <table v-else class="pending-costs-table">
      <thead>
        <tr>
          <th>Foto</th>
          <th>Reloj</th>
          <th>Precio público</th>
          <th>Registrado</th>
          <th>Costo (COP)</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="watch in watches" :key="watch.id">
          <td>
            <img
              :src="watch.primaryImageUrl || watch.frontImageUrl || watch.images[0] || ''"
              :alt="watch.model"
              class="pending-costs-thumb"
            >
          </td>
          <td>
            <strong>{{ watch.brand.name }} {{ watch.model }}</strong>
            <span class="pending-costs-sku">{{ watch.sku }}</span>
          </td>
          <td>{{ formatCop(watch.retailPrice) }}</td>
          <td>{{ new Date(watch.createdAt).toLocaleDateString('es-CO') }}</td>
          <td>
            <UiLuxInput
              v-model="costDrafts[watch.id]"
              type="number"
              placeholder="0"
              min="0"
            />
          </td>
          <td>
            <UiLuxButton
              :disabled="savingId === watch.id"
              @click="saveCost(watch)"
            >
              {{ savingId === watch.id ? 'Guardando...' : 'Guardar' }}
            </UiLuxButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.pending-costs {
  max-width: 1200px;
}

.pending-costs-intro {
  margin: 0 0 24px;
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white-dim);
}

.pending-costs-empty {
  padding: 32px;
  text-align: center;
  color: var(--lux-white-dim);
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.pending-costs-table {
  width: 100%;
  border-collapse: collapse;
}

.pending-costs-table th,
.pending-costs-table td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.12);
  text-align: left;
  vertical-align: middle;
}

.pending-costs-table th {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.pending-costs-thumb {
  width: 56px;
  height: 84px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.03);
}

.pending-costs-sku {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--lux-white-dim);
}
</style>
