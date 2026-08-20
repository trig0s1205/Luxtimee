import { defineStore } from 'pinia';
import type { BrandDto, CategoryDto, MechanismDto } from '@luxtime/shared';

const TTL_MS = 5 * 60 * 1000;

export const useAdminCatalogStore = defineStore('adminCatalog', {
  state: () => ({
    brands: [] as BrandDto[],
    categories: [] as CategoryDto[],
    mechanisms: [] as MechanismDto[],
    brandsLoadedAt: 0,
    categoriesLoadedAt: 0,
    mechanismsLoadedAt: 0,
    loadingBrands: false,
    loadingCategories: false,
    loadingMechanisms: false,
  }),
  getters: {
    brandsStale: (state) => Date.now() - state.brandsLoadedAt > TTL_MS,
    categoriesStale: (state) => Date.now() - state.categoriesLoadedAt > TTL_MS,
    mechanismsStale: (state) => Date.now() - state.mechanismsLoadedAt > TTL_MS,
  },
  actions: {
    async ensureBrands(fetcher: () => Promise<BrandDto[]>) {
      if (!this.brandsStale && this.brands.length) return;
      if (this.loadingBrands) return;
      this.loadingBrands = true;
      try {
        this.brands = await fetcher();
        this.brandsLoadedAt = Date.now();
      } catch {
        if (!this.brands.length) this.brands = [];
      } finally {
        this.loadingBrands = false;
      }
    },
    async ensureCategories(fetcher: () => Promise<CategoryDto[]>) {
      if (!this.categoriesStale && this.categories.length) return;
      if (this.loadingCategories) return;
      this.loadingCategories = true;
      try {
        this.categories = await fetcher();
        this.categoriesLoadedAt = Date.now();
      } catch {
        if (!this.categories.length) this.categories = [];
      } finally {
        this.loadingCategories = false;
      }
    },
    async ensureMechanisms(fetcher: () => Promise<MechanismDto[]>) {
      if (!this.mechanismsStale && this.mechanisms.length) return;
      if (this.loadingMechanisms) return;
      this.loadingMechanisms = true;
      try {
        this.mechanisms = await fetcher();
        this.mechanismsLoadedAt = Date.now();
      } catch {
        if (!this.mechanisms.length) this.mechanisms = [];
      } finally {
        this.loadingMechanisms = false;
      }
    },
    async ensureAll(fetcher: {
      brands: () => Promise<BrandDto[]>;
      categories: () => Promise<CategoryDto[]>;
      mechanisms?: () => Promise<MechanismDto[]>;
    }) {
      const tasks: Promise<void>[] = [
        this.ensureBrands(fetcher.brands),
        this.ensureCategories(fetcher.categories),
      ];
      if (fetcher.mechanisms) tasks.push(this.ensureMechanisms(fetcher.mechanisms));
      await Promise.all(tasks);
    },
    invalidate() {
      this.brandsLoadedAt = 0;
      this.categoriesLoadedAt = 0;
      this.mechanismsLoadedAt = 0;
    },
    addBrand(brand: BrandDto) {
      this.brands.push(brand);
    },
    removeBrand(id: string) {
      this.brands = this.brands.filter((b) => b.id !== id);
    },
    addCategory(category: CategoryDto) {
      this.categories.push(category);
    },
    removeCategory(id: string) {
      this.categories = this.categories.filter((c) => c.id !== id);
    },
    addMechanism(mechanism: MechanismDto) {
      this.mechanisms.push(mechanism);
    },
    removeMechanism(id: string) {
      this.mechanisms = this.mechanisms.filter((m) => m.id !== id);
    },
  },
});
