<script setup lang="ts">
import type {
  CreateWholesaleAccessDto,
  WholesaleAccessDto,
  WholesaleAccessListDto,
  WholesalerOrderHistoryDto,
  WholesalerReportDto,
} from '@luxtime/shared';
import { DEFAULT_WHOLESALE_COOKIE_DAYS } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const cookieDurationOptions = [
  { value: 1, label: '1 día' },
  { value: 7, label: '7 días' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
  { value: 60, label: '60 días' },
  { value: 90, label: '90 días' },
  { value: 180, label: '180 días' },
  { value: 365, label: '1 año' },
];

const form = reactive<CreateWholesaleAccessDto>({
  name: '',
  email: '',
  phone: '',
  notes: '',
  cookieDurationDays: DEFAULT_WHOLESALE_COOKIE_DAYS,
  expiresAt: '',
});

const creating = ref(false);
const deletingId = ref<string | null>(null);
const freshLink = ref('');
const history = ref<Record<string, WholesalerOrderHistoryDto | null>>({});
const historyOpen = ref<Record<string, boolean>>({});

const { data: reportData, refresh: refreshReport } = useAdminCachedData(
  'wholesale-access-report',
  () => api.get<WholesalerReportDto>('/wholesale-access/reports'),
);

const report = computed(() => reportData.value?.items ?? []);

const { data, refresh, pending } = useAdminCachedData('wholesale-access-list', () =>
  api.get<WholesaleAccessListDto>('/wholesale-access'),
);

const items = computed(() => data.value?.items ?? []);

function durationLabel(days: number) {
  return cookieDurationOptions.find((option) => option.value === days)?.label ?? `${days} días`;
}

async function createAccess() {
  if (!form.name.trim()) {
    toast.error('El nombre es obligatorio.');
    return;
  }
  creating.value = true;
  try {
    const created = await api.post<WholesaleAccessDto>('/wholesale-access', {
      ...form,
      email: form.email?.trim() || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    });
    freshLink.value = created.accessUrl ?? '';
    toast.success('Acceso mayorista creado. Copia el enlace ahora.');
    form.name = '';
    form.email = '';
    form.phone = '';
    form.notes = '';
    form.expiresAt = '';
    form.cookieDurationDays = DEFAULT_WHOLESALE_COOKIE_DAYS;
    await Promise.all([refresh(), refreshReport()]);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo crear el acceso.'));
  } finally {
    creating.value = false;
  }
}

async function copyText(value: string) {
  if (!import.meta.client || !value) return;
  await navigator.clipboard.writeText(value);
  toast.success('Enlace copiado.');
}

async function copyLink(item: WholesaleAccessDto) {
  if (item.accessUrl) {
    await copyText(item.accessUrl);
    return;
  }
  toast.error('El enlace solo se muestra al crearlo o regenerarlo.');
}

async function toggleActive(item: WholesaleAccessDto) {
  await api.patch(`/wholesale-access/${item.id}`, { isActive: !item.isActive });
  await refresh();
}

async function regenerate(item: WholesaleAccessDto) {
  const created = await api.post<WholesaleAccessDto>(`/wholesale-access/${item.id}/regenerate`);
  freshLink.value = created.accessUrl ?? '';
  toast.success('Nuevo enlace generado. Cópialo ahora.');
  await refresh();
}

async function updateDuration(item: WholesaleAccessDto, days: number) {
  if (days === item.cookieDurationDays) return;
  await api.patch(`/wholesale-access/${item.id}`, { cookieDurationDays: days });
  toast.success('Duración de cookie actualizada.');
  await refresh();
}

async function updateExpiry(item: WholesaleAccessDto, value: string) {
  await api.patch(`/wholesale-access/${item.id}`, {
    expiresAt: value ? new Date(value).toISOString() : null,
  });
  toast.success(value ? 'Vencimiento actualizado.' : 'El enlace ya no vence.');
  await refresh();
}

function expiryInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isExpired(item: WholesaleAccessDto) {
  return !!item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
}

async function toggleHistory(id: string) {
  historyOpen.value[id] = !historyOpen.value[id];
  if (!historyOpen.value[id] || history.value[id]) return;
  history.value[id] = await api.get<WholesalerOrderHistoryDto>(`/wholesale-access/${id}/orders`);
}

async function removeAccess(item: WholesaleAccessDto) {
  if (item.isActive) {
    toast.warning('Revoca el acceso antes de eliminarlo.');
    return;
  }

  const ok = await confirm({
    title: `¿Eliminar a ${item.name}?`,
    message: 'Se borrará el registro y su enlace revocado. Esta acción no se puede deshacer.',
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;

  deletingId.value = item.id;
  try {
    await api.del(`/wholesale-access/${item.id}`);
    toast.success('Mayorista eliminado.');
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar el mayorista.'));
  } finally {
    deletingId.value = null;
  }
}

useSeoMeta({ title: 'Mayoristas — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiToastContainer />
    <UiSectionHeader
      label="Ventas"
      title="Mayoristas"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <p class="admin-records-hint">
      Crea accesos privados y comparte el enlace. El token se guarda como hash: solo se muestra al crearlo o regenerarlo. Los enlaces ya entregados siguen funcionando.
    </p>

    <p v-if="freshLink" class="admin-records-hint break-all">
      Enlace nuevo: {{ freshLink }}
      <button type="button" class="admin-record-btn" @click="copyText(freshLink)">Copiar</button>
    </p>

    <section class="admin-record-export">
      <h3>Reporte</h3>
      <p class="admin-record-muted">Pedidos confirmados no cancelados, unidades e ingresos por mayorista.</p>
      <div v-if="!report.length" class="admin-record-empty">Sin movimientos confirmados.</div>
      <table v-else class="admin-record-table">
        <thead>
          <tr>
            <th>Mayorista</th>
            <th>Pedidos</th>
            <th>Unidades</th>
            <th>Ingresos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in report" :key="row.id">
            <td>{{ row.name }}</td>
            <td>{{ row.orders }}</td>
            <td>{{ row.units }}</td>
            <td>{{ formatCop(row.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="admin-record-export">
      <h3>Nuevo acceso</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UiLuxInput v-model="form.name" placeholder="Nombre del mayorista" />
        <UiLuxInput v-model="form.email" type="email" placeholder="Correo (opcional)" />
        <UiLuxInput v-model="form.phone" placeholder="Teléfono (opcional)" />
        <UiLuxInput v-model="form.notes" placeholder="Notas internas (opcional)" />
        <label class="admin-record-field">
          <span class="admin-record-muted">Vence el (opcional)</span>
          <input v-model="form.expiresAt" class="admin-record-select" type="datetime-local" />
        </label>
        <label class="admin-record-field">
          <span class="admin-record-muted">Duración de acceso en navegador</span>
          <select v-model.number="form.cookieDurationDays" class="admin-record-select">
            <option v-for="option in cookieDurationOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" :disabled="creating" @click="createAccess">
          {{ creating ? 'Creando...' : 'Crear acceso' }}
        </button>
      </div>
    </section>

    <div v-if="pending && !items.length" class="admin-record-empty">Cargando mayoristas...</div>

    <div v-else class="admin-records-list">
      <article v-for="item in items" :key="item.id" class="admin-record-card">
        <div class="admin-record-details-inner" style="padding: 16px;">
          <div class="flex flex-wrap justify-between gap-3">
            <div>
              <p class="admin-record-title">{{ item.name }}</p>
              <p v-if="item.email" class="admin-record-muted">{{ item.email }}</p>
              <p v-if="item.phone" class="admin-record-muted">{{ item.phone }}</p>
            </div>
            <UiLuxBadge :tone="!item.isActive || isExpired(item) ? 'cancelado' : 'pagado'">
              {{ !item.isActive ? 'Revocado' : isExpired(item) ? 'Vencido' : 'Activo' }}
            </UiLuxBadge>
          </div>
          <p v-if="item.notes" class="admin-record-muted mt-3">{{ item.notes }}</p>
          <label class="admin-record-field mt-3">
            <span class="admin-record-muted">Cookie en navegador: {{ durationLabel(item.cookieDurationDays) }}</span>
            <select
              class="admin-record-select"
              :value="item.cookieDurationDays"
              @change="updateDuration(item, Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="option in cookieDurationOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="admin-record-field mt-3">
            <span class="admin-record-muted">
              Vencimiento del enlace{{ item.expiresAt ? `: ${new Date(item.expiresAt).toLocaleString('es-CO')}` : ': sin fecha' }}
            </span>
            <input
              class="admin-record-select"
              type="datetime-local"
              :value="expiryInputValue(item.expiresAt)"
              @change="updateExpiry(item, ($event.target as HTMLInputElement).value)"
            />
          </label>
          <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="updateExpiry(item, '')">
            Quitar vencimiento
          </button>
          <p v-if="item.accessUrl" class="admin-record-muted mt-2 text-xs break-all">{{ item.accessUrl }}</p>
          <p v-else class="admin-record-muted mt-2 text-xs">Enlace oculto. Regenera para copiar uno nuevo.</p>
          <div class="admin-record-actions">
            <button type="button" class="admin-record-btn admin-record-btn--primary" @click="copyLink(item)">
              Copiar enlace
            </button>
            <button type="button" class="admin-record-btn" @click="toggleActive(item)">
              {{ item.isActive ? 'Revocar' : 'Reactivar' }}
            </button>
            <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="regenerate(item)">
              Nuevo enlace
            </button>
            <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="toggleHistory(item.id)">
              {{ historyOpen[item.id] ? 'Ocultar historial' : 'Historial' }}
            </button>
            <button
              v-if="!item.isActive"
              type="button"
              class="admin-record-btn admin-record-btn--danger"
              :disabled="deletingId === item.id"
              @click="removeAccess(item)"
            >
              {{ deletingId === item.id ? '...' : 'Eliminar' }}
            </button>
          </div>
          <ul v-if="historyOpen[item.id]" class="admin-record-list">
            <li v-if="!history[item.id]" class="admin-record-muted">Cargando historial...</li>
            <li v-else-if="!history[item.id]?.items.length" class="admin-record-muted">Sin pedidos.</li>
            <li v-for="order in history[item.id]?.items ?? []" :key="order.id" class="admin-record-muted">
              {{ order.readableId }} · {{ order.stage }} {{ order.status || '' }} · {{ order.units }} u · {{ formatCop(order.total) }}
            </li>
          </ul>
        </div>
      </article>
      <p v-if="!items.length" class="admin-record-empty">Aún no hay mayoristas autorizados.</p>
    </div>
  </div>
</template>

<style scoped>
.admin-record-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-record-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(200, 169, 110, 0.2);
  background: rgba(0, 0, 0, 0.35);
  color: inherit;
  font-size: 14px;
}

.admin-record-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 14px;
}

.admin-record-table th,
.admin-record-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
}
</style>



