<script setup lang="ts">
import type { CommissionConfigDto, CommissionUpdateResultDto } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();

if (!auth.loaded) {
  await auth.fetchMe();
}
if (!auth.isSuperAdmin) {
  throw createError({ statusCode: 403, message: 'Solo Super Admin' });
}

const form = reactive<CommissionConfigDto>({ percent: 5 });
const saving = ref(false);
const lastUpdate = ref<CommissionUpdateResultDto | null>(null);

await useAsyncData('secretaria-commission', async () => {
  const res = await api.get<CommissionConfigDto>('/settings/commission');
  form.percent = res.percent;
  return res;
});

async function save() {
  saving.value = true;
  try {
    const result = await api.patch<CommissionUpdateResultDto>('/settings/commission', {
      percent: Number(form.percent),
    });
    lastUpdate.value = result;
    toast.success(`Comisión actualizada al ${result.percent}% en ${result.updatedWatches} relojes.`);
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err
      ? String(err.message)
      : 'No se pudo guardar la comisión.';
    toast.warning(message);
  } finally {
    saving.value = false;
  }
}

useSeoMeta({ title: 'Secretaría — Luxtime Admin' });
</script>

<template>
  <div class="max-w-xl space-y-6">
    <UiSectionHeader label="Finanzas" title="Secretaría" />
    <p class="admin-form-hint admin-page-intro">
      Define el porcentaje de comisión global para la secretaría. Se aplica a todos los relojes del inventario y recalcula las ventas ya registradas en el dashboard.
    </p>

    <div class="admin-form-field">
      <label>% Comisión secretaría</label>
      <UiLuxInput v-model="form.percent" type="number" min="0" max="100" step="0.01" placeholder="Ej. 5" />
      <p class="admin-form-hint">
        Este porcentaje se aplica sobre el ingreso de cada venta y se sincroniza con todos los relojes activos.
      </p>
    </div>

    <UiLuxButton :disabled="saving" @click="save">
      {{ saving ? 'Guardando...' : 'Guardar comisión' }}
    </UiLuxButton>

    <p v-if="lastUpdate" class="text-lux-gold text-sm">
      Última actualización: {{ lastUpdate.percent }}% aplicado a {{ lastUpdate.updatedWatches }} relojes.
    </p>
  </div>
</template>

<style scoped>
.admin-form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-form-field label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-form-hint {
  margin: 0;
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white-dim);
}

.admin-page-intro {
  margin-bottom: 8px;
}
</style>
