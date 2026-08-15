<script setup lang="ts">
import type { CreateWholesaleAccessDto, WholesaleAccessDto, WholesaleAccessListDto } from '@luxtime/shared';
import { DEFAULT_WHOLESALE_COOKIE_DAYS } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';

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
});

const creating = ref(false);
const deletingId = ref<string | null>(null);

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
    await api.post<WholesaleAccessDto>('/wholesale-access', {
      ...form,
      email: form.email?.trim() || undefined,
    });
    toast.success('Acceso mayorista creado.');
    form.name = '';
    form.email = '';
    form.phone = '';
    form.notes = '';
    form.cookieDurationDays = DEFAULT_WHOLESALE_COOKIE_DAYS;
    await refresh();
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo crear el acceso.'));
  } finally {
    creating.value = false;
  }
}

async function copyLink(item: WholesaleAccessDto) {
  if (!import.meta.client) return;
  await navigator.clipboard.writeText(item.accessUrl);
  toast.success('Enlace copiado.');
}

async function toggleActive(item: WholesaleAccessDto) {
  await api.patch(`/wholesale-access/${item.id}`, { isActive: !item.isActive });
  await refresh();
}

async function regenerate(item: WholesaleAccessDto) {
  await api.post<WholesaleAccessDto>(`/wholesale-access/${item.id}/regenerate`);
  toast.success('Nuevo enlace generado.');
  await refresh();
}

async function updateDuration(item: WholesaleAccessDto, days: number) {
  if (days === item.cookieDurationDays) return;
  await api.patch(`/wholesale-access/${item.id}`, { cookieDurationDays: days });
  toast.success('Duración de cookie actualizada.');
  await refresh();
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
      Crea accesos privados y comparte el enlace con cada mayorista. Solo quien tenga un enlace activo puede ver el catálogo mayorista.
    </p>

    <section class="admin-record-export">
      <h3>Nuevo acceso</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UiLuxInput v-model="form.name" placeholder="Nombre del mayorista" />
        <UiLuxInput v-model="form.email" type="email" placeholder="Correo (opcional)" />
        <UiLuxInput v-model="form.phone" placeholder="Teléfono (opcional)" />
        <UiLuxInput v-model="form.notes" placeholder="Notas internas (opcional)" />
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
            <UiLuxBadge :tone="item.isActive ? 'pagado' : 'cancelado'">
              {{ item.isActive ? 'Activo' : 'Revocado' }}
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
          <p class="admin-record-muted mt-2 text-xs break-all">{{ item.accessUrl }}</p>
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
</style>



