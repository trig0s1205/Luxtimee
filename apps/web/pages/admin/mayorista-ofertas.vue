<script setup lang="ts">
import type { PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';

definePageMeta({ middleware: ['admin'], keepalive: true });

type ExtraRow = { id: string; name: string; price: number; sortOrder: number; isActive: boolean };
type PackageRow = {
  id: string;
  name: string;
  minQuantity: number;
  unitPrice: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  watchIds: string[];
};

const api = useApi();
const toast = useToast();

const { data, refresh, pending } = useAdminCachedData(
  'wholesale-offers-admin',
  () => api.get<{ extras: ExtraRow[]; packages: PackageRow[] }>('/wholesale-offers'),
);

const creatingExtra = ref(false);
const creatingPackage = ref(false);
const extraForm = reactive({ name: '', price: 0 });
const packageForm = reactive({
  name: '',
  minQuantity: 10,
  unitPrice: 0,
  startsAt: '',
  endsAt: '',
  isActive: true,
  watchIds: [] as string[],
});
const watchQuery = ref('');
const watchHits = ref<Array<Pick<WatchStaffDto, 'id' | 'sku' | 'model' | 'brand'>>>([]);

function dateInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function datePayload(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function createExtra() {
  creatingExtra.value = true;
  try {
    await api.post('/wholesale-offers/extras', {
      name: extraForm.name.trim(),
      price: Number(extraForm.price) || 0,
    });
    extraForm.name = '';
    extraForm.price = 0;
    await refresh();
    toast.success('Opción creada.');
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo crear la opción.'));
  } finally {
    creatingExtra.value = false;
  }
}

async function saveExtra(extra: ExtraRow) {
  try {
    await api.patch(`/wholesale-offers/extras/${extra.id}`, {
      name: extra.name.trim(),
      price: Math.max(0, Number(extra.price) || 0),
      sortOrder: Number(extra.sortOrder) || 0,
      isActive: extra.isActive,
    });
    toast.success('Opción guardada.');
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo guardar la opción.'));
  }
}

async function removeExtra(id: string) {
  try {
    await api.del(`/wholesale-offers/extras/${id}`);
    await refresh();
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo quitar la opción.'));
  }
}

async function searchWatches() {
  const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
    search: watchQuery.value || undefined,
    page: 1,
    limit: 8,
  });
  watchHits.value = res.data;
}

function toggleWatch(id: string) {
  if (packageForm.watchIds.includes(id)) {
    packageForm.watchIds = packageForm.watchIds.filter((item) => item !== id);
    return;
  }
  packageForm.watchIds = [...packageForm.watchIds, id];
}

async function createPackage() {
  creatingPackage.value = true;
  try {
    await api.post('/wholesale-offers/packages', {
      name: packageForm.name.trim(),
      minQuantity: Number(packageForm.minQuantity) || 1,
      unitPrice: Math.max(0, Number(packageForm.unitPrice) || 0),
      isActive: packageForm.isActive,
      startsAt: datePayload(packageForm.startsAt),
      endsAt: datePayload(packageForm.endsAt),
      watchIds: packageForm.watchIds,
    });
    packageForm.name = '';
    packageForm.unitPrice = 0;
    packageForm.watchIds = [];
    await refresh();
    toast.success('Paquete creado.');
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo crear el paquete.'));
  } finally {
    creatingPackage.value = false;
  }
}

async function savePackage(pkg: PackageRow) {
  try {
    await api.patch(`/wholesale-offers/packages/${pkg.id}`, {
      name: pkg.name.trim(),
      minQuantity: Number(pkg.minQuantity) || 1,
      unitPrice: Math.max(0, Number(pkg.unitPrice) || 0),
      isActive: pkg.isActive,
      startsAt: pkg.startsAt,
      endsAt: pkg.endsAt,
      watchIds: pkg.watchIds,
    });
    toast.success('Paquete guardado.');
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo guardar el paquete.'));
  }
}

async function removePackage(id: string) {
  try {
    await api.del(`/wholesale-offers/packages/${id}`);
    await refresh();
  } catch (error: unknown) {
    toast.error(extractApiErrorMessage(error, 'No se pudo quitar el paquete.'));
  }
}

useSeoMeta({ title: 'Ofertas mayorista — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiToastContainer />
    <UiSectionHeader
      label="Ventas"
      title="Ofertas mayorista"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <p class="admin-records-hint">
      El precio del reloj es el mínimo. Estas opciones solo suman si el cliente pide más. Un paquete es el único precio menor.
    </p>

    <section class="admin-record-export">
      <h3>Nueva opción</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UiLuxInput v-model="extraForm.name" placeholder="Nombre, ej. Caja" />
        <UiLuxInput v-model.number="extraForm.price" type="number" min="0" placeholder="Precio extra por unidad" />
      </div>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" :disabled="creatingExtra" @click="createExtra">
          {{ creatingExtra ? 'Creando...' : 'Crear opción' }}
        </button>
      </div>
    </section>

    <section v-for="extra in data?.extras ?? []" :key="extra.id" class="admin-record-export">
      <div class="grid gap-3 md:grid-cols-4">
        <UiLuxInput v-model="extra.name" placeholder="Nombre" />
        <UiLuxInput v-model.number="extra.price" type="number" min="0" placeholder="Precio extra" />
        <UiLuxInput v-model.number="extra.sortOrder" type="number" min="0" placeholder="Orden" />
        <label class="admin-record-field">
          <input v-model="extra.isActive" type="checkbox" />
          Activa
        </label>
      </div>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" @click="saveExtra(extra)">Guardar</button>
        <button type="button" class="admin-record-btn" @click="removeExtra(extra.id)">Quitar</button>
      </div>
    </section>

    <section class="admin-record-export">
      <h3>Nuevo paquete</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UiLuxInput v-model="packageForm.name" placeholder="Nombre del paquete" />
        <UiLuxInput v-model.number="packageForm.minQuantity" type="number" min="1" placeholder="Cantidad mínima" />
        <UiLuxInput v-model.number="packageForm.unitPrice" type="number" min="0" placeholder="Precio por reloj" />
        <label class="admin-record-field">
          <span class="admin-record-muted">Inicio</span>
          <input v-model="packageForm.startsAt" type="datetime-local" class="admin-record-select" />
        </label>
        <label class="admin-record-field">
          <span class="admin-record-muted">Fin</span>
          <input v-model="packageForm.endsAt" type="datetime-local" class="admin-record-select" />
        </label>
        <label class="admin-record-field">
          <input v-model="packageForm.isActive" type="checkbox" />
          Activo
        </label>
      </div>
      <div class="grid gap-3 md:grid-cols-[1fr_auto] mt-3">
        <UiLuxInput v-model="watchQuery" placeholder="Buscar reloj por SKU o modelo. Vacío = todos." @keyup.enter="searchWatches" />
        <button type="button" class="admin-record-btn" @click="searchWatches">Buscar</button>
      </div>
      <div v-if="watchHits.length" class="mt-3 space-y-1">
        <label v-for="watch in watchHits" :key="watch.id" class="admin-record-field">
          <input :checked="packageForm.watchIds.includes(watch.id)" type="checkbox" @change="toggleWatch(watch.id)" />
          {{ watch.sku }} — {{ watch.brand?.name }} {{ watch.model }}
        </label>
      </div>
      <p v-if="packageForm.watchIds.length" class="admin-record-muted mt-2">{{ packageForm.watchIds.length }} reloj(es) en el paquete. Si no eliges ninguno, aplica a todos.</p>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" :disabled="creatingPackage" @click="createPackage">
          {{ creatingPackage ? 'Creando...' : 'Crear paquete' }}
        </button>
      </div>
    </section>

    <section v-for="pkg in data?.packages ?? []" :key="pkg.id" class="admin-record-export">
      <div class="grid gap-3 md:grid-cols-2">
        <UiLuxInput v-model="pkg.name" placeholder="Nombre" />
        <UiLuxInput v-model.number="pkg.minQuantity" type="number" min="1" placeholder="Cantidad mínima" />
        <UiLuxInput v-model.number="pkg.unitPrice" type="number" min="0" placeholder="Precio por reloj" />
        <label class="admin-record-field">
          <input v-model="pkg.isActive" type="checkbox" />
          Activo
        </label>
        <label class="admin-record-field">
          <span class="admin-record-muted">Inicio</span>
          <input :value="dateInput(pkg.startsAt)" type="datetime-local" class="admin-record-select" @input="pkg.startsAt = datePayload(($event.target as HTMLInputElement).value)" />
        </label>
        <label class="admin-record-field">
          <span class="admin-record-muted">Fin</span>
          <input :value="dateInput(pkg.endsAt)" type="datetime-local" class="admin-record-select" @input="pkg.endsAt = datePayload(($event.target as HTMLInputElement).value)" />
        </label>
      </div>
      <p class="admin-record-muted mt-2">
        {{ pkg.watchIds.length ? `${pkg.watchIds.length} reloj(es)` : 'Aplica a todos los relojes' }}
      </p>
      <button v-if="pkg.watchIds.length" type="button" class="admin-record-btn mt-2" @click="pkg.watchIds = []">
        Aplicar a todos los relojes
      </button>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" @click="savePackage(pkg)">Guardar</button>
        <button type="button" class="admin-record-btn" @click="removePackage(pkg.id)">Quitar</button>
      </div>
    </section>
  </div>
</template>
