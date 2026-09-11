<script setup lang="ts">
import type { PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { watchPrimaryImage } from '~/utils/media-url';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const toast = useToast();

const PAGE_SIZE = 40;
const page = ref(1);
const searchInput = ref('');
const search = ref('');
const togglingId = ref<string | null>(null);

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    search.value = searchInput.value.trim();
    page.value = 1;
  }, 300);
}

const listKey = computed(() => `catalog-destacados-${search.value}-${page.value}`);

const emptyList: PaginatedResponse<WatchStaffDto> = {
  data: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
};

const { data: paginated, refresh, pending } = useAdminCachedData(
  listKey,
  () =>
    api
      .get<PaginatedResponse<WatchStaffDto>>('/watches', {
        search: search.value || undefined,
        page: page.value,
        limit: PAGE_SIZE,
      })
      .catch(() => emptyList),
  { watch: [listKey] },
);

const { data: featuredCount, refresh: refreshCount } = useAdminCachedData(
  'featured-count',
  () => api.get<{ count: number; max: number }>('/watches/featured/count'),
);

const eligibleWatches = computed(() =>
  (paginated.value?.data ?? []).filter(
    (w) => w.isPublished && w.isActive && w.stock > 0,
  ),
);

const total = computed(() => paginated.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const featuredSlots = computed(() => featuredCount.value ?? { count: 0, max: 6 });

function goToPage(next: number) {
  if (next < 1 || next > totalPages.value) return;
  page.value = next;
}

async function toggleSpotlight(watch: WatchStaffDto) {
  const next = !watch.showInCatalog;
  if (next) {
    const { count, max } = await api.get<{ count: number; max: number }>('/watches/featured/count', {
      excludeId: watch.id,
    });
    if (count >= max) {
      toast.warning(`Máximo ${max} relojes en el hero. Quita uno antes de añadir otro.`);
      return;
    }
  }

  togglingId.value = watch.id;
  try {
    await api.patch(`/watches/${watch.id}`, { showInCatalog: next });
    toast.success(next ? 'Reloj añadido al hero del inicio.' : 'Reloj quitado del hero.');
    await Promise.all([refresh(), refreshCount()]);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo actualizar el destacado.'));
  } finally {
    togglingId.value = null;
  }
}

useSeoMeta({ title: 'Destacados en inicio — LUXTIMEE Admin' });
</script>

<template>
  <div class="catalog-destacados">
    <UiToastContainer />
    <UiSectionHeader
      label="Catálogo"
      title="Destacados en el inicio (hero)"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <p class="catalog-destacados-intro">
      El hero mezcla estos relojes (hasta {{ featuredSlots.max }}) con los más vendidos.
      Úsalo para novedades sin ventas aún. Solo aparecen relojes publicados con stock.
    </p>
    <p class="catalog-destacados-slots">
      En hero ahora: <strong>{{ featuredSlots.count }}</strong> / {{ featuredSlots.max }}
    </p>

    <div class="catalog-destacados-toolbar">
      <UiLuxInput
        v-model="searchInput"
        placeholder="Buscar por SKU, marca o modelo..."
        @input="onSearchInput"
      />
    </div>

    <div v-if="pending && !eligibleWatches.length" class="catalog-destacados-empty">Cargando...</div>
    <div v-else-if="!eligibleWatches.length" class="catalog-destacados-empty">
      No hay relojes publicados con stock en esta página.
    </div>

    <table v-else class="catalog-destacados-table">
      <thead>
        <tr>
          <th>Foto</th>
          <th>Reloj</th>
          <th>Stock</th>
          <th>En hero</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="watch in eligibleWatches" :key="watch.id">
          <td>
            <img
              v-if="watchPrimaryImage(watch)"
              :src="watchPrimaryImage(watch)"
              :alt="watch.model"
              class="catalog-destacados-thumb"
            >
          </td>
          <td>
            <strong>{{ watch.brand.name }} {{ watch.model }}</strong>
            <span class="catalog-destacados-sku">{{ watch.sku }}</span>
          </td>
          <td>{{ watch.stock }}</td>
          <td>
            <span
              class="catalog-destacados-badge"
              :class="{ 'is-on': watch.showInCatalog }"
            >
              {{ watch.showInCatalog ? 'Sí' : 'No' }}
            </span>
          </td>
          <td>
            <UiLuxButton
              :disabled="togglingId === watch.id"
              @click="toggleSpotlight(watch)"
            >
              {{
                togglingId === watch.id
                  ? 'Guardando...'
                  : watch.showInCatalog
                    ? 'Quitar del hero'
                    : 'Mostrar en hero'
              }}
            </UiLuxButton>
          </td>
        </tr>
      </tbody>
    </table>

    <nav v-if="totalPages > 1" class="catalog-destacados-pagination" aria-label="Paginación">
      <button type="button" class="catalog-destacados-page-btn" :disabled="page <= 1 || pending" @click="goToPage(page - 1)">
        Anterior
      </button>
      <span class="catalog-destacados-page-info">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="catalog-destacados-page-btn" :disabled="page >= totalPages || pending" @click="goToPage(page + 1)">
        Siguiente
      </button>
    </nav>
  </div>
</template>

<style scoped>
.catalog-destacados {
  max-width: 1100px;
}

.catalog-destacados-intro,
.catalog-destacados-slots {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--lux-white-dim);
}

.catalog-destacados-toolbar {
  margin-bottom: 20px;
}

.catalog-destacados-empty {
  padding: 32px;
  text-align: center;
  color: var(--lux-white-dim);
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.catalog-destacados-table {
  width: 100%;
  border-collapse: collapse;
}

.catalog-destacados-table th,
.catalog-destacados-table td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.12);
  text-align: left;
  vertical-align: middle;
}

.catalog-destacados-table th {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.catalog-destacados-thumb {
  width: 48px;
  height: 72px;
  object-fit: contain;
}

.catalog-destacados-sku {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--lux-white-dim);
}

.catalog-destacados-badge {
  font-size: 12px;
  color: var(--lux-white-dim);
}

.catalog-destacados-badge.is-on {
  color: var(--lux-gold, #c8a96e);
}

.catalog-destacados-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.catalog-destacados-page-btn {
  padding: 10px 18px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  font-size: 11px;
  color: var(--lux-white);
  cursor: pointer;
}

.catalog-destacados-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-destacados-page-info {
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
