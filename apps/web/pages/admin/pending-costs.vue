<script setup lang="ts">
import type { PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();

if (!auth.loaded) await auth.fetchMe();
if (!auth.isSuperAdmin) throw createError({ statusCode: 403, message: 'Solo Super Admin' });

const PAGE_SIZE = 10;
const page = ref(1);
const costDrafts = reactive<Record<string, string>>({});
const savingId = ref<string | null>(null);

const emptyList: PaginatedResponse<WatchStaffDto> = {
  data: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
};

const { data: paginated, refresh, pending } = await useAsyncData(
  'pending-cost-watches',
  () => api.get<PaginatedResponse<WatchStaffDto>>('/watches/pending-cost', { page: page.value, limit: PAGE_SIZE }).catch(() => emptyList),
  { watch: [page] },
);

const watches = computed(() => paginated.value?.data ?? []);
const total = computed(() => paginated.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
}

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

useSeoMeta({ title: 'Relojes pendientes de costo — LUXTIMEE Admin' });
</script>

<template>
  <div class="pending-costs">
    <UiToastContainer />
    <UiSectionHeader label="Finanzas" :title="`Relojes pendientes de costo (${total})`" />
    <p class="pending-costs-intro">
      Relojes sin costo asignado (vacío o en 0). Al guardar un costo mayor a 0 se calculan los márgenes automáticamente.
    </p>

    <div v-if="pending && !watches.length" class="pending-costs-empty">Cargando...</div>
    <div v-else-if="!watches.length" class="pending-costs-empty">No hay relojes pendientes de costo.</div>

    <template v-else>
      <table class="pending-costs-table">
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

      <nav v-if="totalPages > 1" class="pending-costs-pagination" aria-label="Paginación pendientes de costo">
        <button type="button" class="pending-costs-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">
          Anterior
        </button>
        <span class="pending-costs-page-info">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" class="pending-costs-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">
          Siguiente
        </button>
      </nav>
    </template>
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

.pending-costs-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pending-costs-page-btn {
  padding: 10px 18px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white);
  cursor: pointer;
}

.pending-costs-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pending-costs-page-info {
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
