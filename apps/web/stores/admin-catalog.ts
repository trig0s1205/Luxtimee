import { defineStore } from 'pinia';
import type { BrandDto, CategoryDto } from '@luxtime/shared';

const TTL_MS = 5 * 60 * 1000;

export const useAdminCatalogStore = defineStore('adminCatalog', {
  state: () => ({
    brands: [] as BrandDto[],
    categories: [] as CategoryDto[],
    brandsLoadedAt: 0,
    categoriesLoadedAt: 0,
    loadingBrands: false,
    loadingCategories: false,
  }),
  getters: {
    brandsStale: (state) => Date.now() - state.brandsLoadedAt > TTL_MS,
    categoriesStale: (state) => Date.now() - state.categoriesLoadedAt > TTL_MS,
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
    async ensureAll(fetcher: { brands: () => Promise<BrandDto[]>; categories: () => Promise<CategoryDto[]> }) {
      await Promise.all([
        this.ensureBrands(fetcher.brands),
        this.ensureCategories(fetcher.categories),
      ]);
    },
    invalidate() {
      this.brandsLoadedAt = 0;
      this.categoriesLoadedAt = 0;
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
  },
});
