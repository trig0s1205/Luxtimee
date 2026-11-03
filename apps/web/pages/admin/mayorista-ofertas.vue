<script setup lang="ts">
import type { PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { watchPrimaryImage } from '~/utils/media-url';

/** La oferta por paquete queda en el código, sin mostrarse. */
const SHOW_WHOLESALE_OFFERS = false;

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
const watchHits = ref<WatchStaffDto[]>([]);
const watchPreview = ref<string | null>(null);

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
    availability: 'sellable',
    page: 1,
    limit: 100,
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

useSeoMeta({ title: 'Opciones de empaque y extras — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-records-page">
    <UiSectionHeader
      label="Ventas"
      title="Opciones de empaque y extras"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <p class="admin-records-hint">
      Aquí solo se registran extras que el cliente puede pedir además del reloj: caja, paño, pila, estuche u otro.
      El nombre es lo que verá en la venta. El precio es un cobro extra por cada reloj, en pesos. No cambia el precio del reloj.
    </p>

    <section class="admin-record-export">
      <h3>Registrar nueva opción</h3>
      <p class="pack-help">
        Ejemplo: si vendes una pila aparte, el nombre es «Pila» y el precio es lo que se suma por cada reloj, por ejemplo 5000.
        Si el extra no se cobra, deja el precio en 0.
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="pack-field">
          <span>Nombre de la opción</span>
          <UiLuxInput v-model="extraForm.name" placeholder="Ej. Caja" />
          <small>Cómo debe aparecer en la venta. Ejemplos: Caja, Paño, Pila, Estuche.</small>
        </label>
        <label class="pack-field">
          <span>Precio extra por reloj (COP)</span>
          <UiLuxInput v-model.number="extraForm.price" type="number" min="0" placeholder="Ej. 5000" />
          <small>Pesos que se suman por cada reloj. Ejemplo: una pila a 5000. Cero si es gratis.</small>
        </label>
      </div>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" :disabled="creatingExtra" @click="createExtra">
          {{ creatingExtra ? 'Guardando...' : 'Registrar opción' }}
        </button>
      </div>
    </section>

    <section v-for="extra in data?.extras ?? []" :key="extra.id" class="admin-record-export">
      <h3 class="pack-existing">{{ extra.name || 'Opción sin nombre' }}</h3>
      <div class="grid gap-3" :class="SHOW_WHOLESALE_OFFERS ? 'md:grid-cols-4' : 'md:grid-cols-3'">
        <label class="pack-field">
          <span>Nombre de la opción</span>
          <UiLuxInput v-model="extra.name" placeholder="Ej. Paño" />
        </label>
        <label class="pack-field">
          <span>Precio extra por reloj (COP)</span>
          <UiLuxInput v-model.number="extra.price" type="number" min="0" placeholder="Ej. 0" />
        </label>
        <label class="pack-field">
          <span>Orden en la lista</span>
          <UiLuxInput v-model.number="extra.sortOrder" type="number" min="0" placeholder="0" />
          <small>0 sale primero. Ejemplo: caja = 0, paño = 1, pila = 2.</small>
        </label>
        <div v-if="SHOW_WHOLESALE_OFFERS" class="pack-field">
          <span>Visible para el mayorista</span>
          <label class="admin-record-field">
            <input v-model="extra.isActive" type="checkbox" />
            Mostrar esta opción
          </label>
          <small>Si lo desmarcas, se oculta y no se borra.</small>
        </div>
      </div>
      <div class="admin-record-actions">
        <button type="button" class="admin-record-btn admin-record-btn--primary" @click="saveExtra(extra)">Guardar</button>
        <button type="button" class="admin-record-btn" @click="removeExtra(extra.id)">Quitar</button>
      </div>
    </section>

    <template v-if="SHOW_WHOLESALE_OFFERS">
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
      <div v-if="watchHits.length" class="mt-3 space-y-2">
        <div v-for="watch in watchHits" :key="watch.id" class="pack-watch">
          <button
            type="button"
            class="admin-record-thumb"
            :disabled="!watchPrimaryImage(watch)"
            :aria-label="`Ver imagen de ${watch.sku}`"
            @click="watchPrimaryImage(watch) && (watchPreview = watchPrimaryImage(watch)!)"
          >
            <img v-if="watchPrimaryImage(watch)" :src="watchPrimaryImage(watch)" :alt="watch.model" width="40" height="40">
            <span v-else>Sin foto</span>
          </button>
          <label class="admin-record-field">
            <input :checked="packageForm.watchIds.includes(watch.id)" type="checkbox" @change="toggleWatch(watch.id)" />
            {{ watch.sku }} — {{ watch.brand?.name }} {{ watch.model }}
          </label>
        </div>
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
    </template>
    <AdminImageLightbox :src="watchPreview" @close="watchPreview = null" />
  </div>
</template>

<style scoped>
.pack-help,
.pack-field small {
  display: block;
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--lux-white-dim);
}

.pack-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pack-field > span,
.pack-existing {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.pack-existing {
  margin: 0 0 10px;
}

.pack-watch {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
