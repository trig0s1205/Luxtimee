<script setup lang="ts">
import type { BrandDto, CategoryDto } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';

useHead({ title: 'Catálogo — Marcas y clases — LUXTIMEE Admin' });
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();
const catalogStore = useAdminCatalogStore();

const activeTab = ref<'brands' | 'categories'>('brands');
const brandName = ref('');
const categoryName = ref('');
const savingBrand = ref(false);
const savingCategory = ref(false);

const brands = computed(() => catalogStore.brands);
const categories = computed(() => catalogStore.categories);
const brandsPending = computed(() => catalogStore.loadingBrands);
const categoriesPending = computed(() => catalogStore.loadingCategories);

await catalogStore.ensureAll({
  brands: () => api.get<BrandDto[]>('/brands').catch(() => []),
  categories: () => api.get<CategoryDto[]>('/categories').catch(() => []),
});

async function createBrand() {
  const name = brandName.value.trim();
  if (!name) {
    toast.warning('Escribe el nombre de la marca.');
    return;
  }
  savingBrand.value = true;
  try {
    const created = await api.post<BrandDto>('/brands', { name });
    brandName.value = '';
    catalogStore.addBrand(created);
    toast.success('Marca creada correctamente');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo crear la marca'));
  } finally {
    savingBrand.value = false;
  }
}

async function deleteBrand(brand: BrandDto) {
  const ok = await confirm({
    title: `¿Eliminar la marca "${brand.name}"?`,
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    await api.del(`/brands/${brand.id}`);
    catalogStore.removeBrand(brand.id);
    toast.success('Marca eliminada');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar la marca'));
  }
}

async function createCategory() {
  const name = categoryName.value.trim();
  if (!name) {
    toast.warning('Escribe el nombre de la clase.');
    return;
  }
  savingCategory.value = true;
  try {
    const created = await api.post<CategoryDto>('/categories', { name });
    categoryName.value = '';
    catalogStore.addCategory(created);
    toast.success('Clase creada correctamente');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo crear la clase'));
  } finally {
    savingCategory.value = false;
  }
}

async function deleteCategory(category: CategoryDto) {
  const ok = await confirm({
    title: `¿Eliminar la clase "${category.name}"?`,
    destructive: true,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    await api.del(`/categories/${category.id}`);
    catalogStore.removeCategory(category.id);
    toast.success('Clase eliminada');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar la clase'));
  }
}
</script>

<template>
  <div class="catalog-settings">
    <UiToastContainer />

    <UiSectionHeader label="Catálogo" title="Marcas y clases" />

    <div class="catalog-settings-tabs">
      <button
        type="button"
        class="catalog-settings-tab"
        :class="{ active: activeTab === 'brands' }"
        @click="activeTab = 'brands'"
      >
        Marcas
      </button>
      <button
        type="button"
        class="catalog-settings-tab"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        Clases / Estilos
      </button>
    </div>

    <section v-show="activeTab === 'brands'" class="catalog-settings-panel">
      <form class="catalog-settings-form" @submit.prevent="createBrand">
        <UiLuxInput v-model="brandName" placeholder="Nueva marca (ej. Patek Philippe)" />
        <UiLuxButton type="submit" :disabled="savingBrand">
          {{ savingBrand ? 'Guardando...' : 'Agregar marca' }}
        </UiLuxButton>
      </form>

      <div class="admin-catalog-table-wrap">
        <table class="admin-catalog-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th class="admin-catalog-table-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="brandsPending">
              <td colspan="3" class="admin-catalog-table-empty">Cargando marcas...</td>
            </tr>
            <tr v-else-if="!brands?.length">
              <td colspan="3" class="admin-catalog-table-empty">No hay marcas registradas.</td>
            </tr>
            <tr v-for="brand in brands" :key="brand.id" class="admin-catalog-table-row">
              <td><strong>{{ brand.name }}</strong></td>
              <td><span class="admin-catalog-table-slug">{{ brand.slug }}</span></td>
              <td class="admin-catalog-table-actions">
                <button type="button" class="admin-catalog-action-btn admin-catalog-action-btn--danger" title="Eliminar" aria-label="Eliminar marca" @click="deleteBrand(brand)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-show="activeTab === 'categories'" class="catalog-settings-panel">
      <form class="catalog-settings-form" @submit.prevent="createCategory">
        <UiLuxInput v-model="categoryName" placeholder="Nueva clase (ej. Deportivo)" />
        <UiLuxButton type="submit" :disabled="savingCategory">
          {{ savingCategory ? 'Guardando...' : 'Agregar clase' }}
        </UiLuxButton>
      </form>

      <div class="admin-catalog-table-wrap">
        <table class="admin-catalog-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th class="admin-catalog-table-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="categoriesPending">
              <td colspan="3" class="admin-catalog-table-empty">Cargando clases...</td>
            </tr>
            <tr v-else-if="!categories?.length">
              <td colspan="3" class="admin-catalog-table-empty">No hay clases registradas.</td>
            </tr>
            <tr v-for="category in categories" :key="category.id" class="admin-catalog-table-row">
              <td><strong>{{ category.name }}</strong></td>
              <td><span class="admin-catalog-table-slug">{{ category.slug }}</span></td>
              <td class="admin-catalog-table-actions">
                <button type="button" class="admin-catalog-action-btn admin-catalog-action-btn--danger" title="Eliminar" aria-label="Eliminar clase" @click="deleteCategory(category)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.catalog-settings {
  max-width: 960px;
}

.catalog-settings-tabs {
  display: flex;
  gap: 0;
  margin: 24px 0 20px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.15);
}

.catalog-settings-tab {
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--lux-font-body);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  cursor: pointer;
}

.catalog-settings-tab.active {
  color: var(--lux-gold);
  border-bottom-color: var(--lux-gold);
}

.catalog-settings-panel {
  animation: fadeIn 0.2s ease;
}

.catalog-settings-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
