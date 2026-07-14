import { defineStore } from 'pinia';

export interface WishlistItemView {
  id: string;
  watchId: string;
  watch: {
    id: string;
    slug: string;
    model: string;
    brand: { name: string };
    retailPrice: number;
    frontImageUrl: string | null;
    stock: number;
  };
}

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    items: [] as WishlistItemView[],
    loaded: false,
  }),

  getters: {
    ids: (state) => new Set(state.items.map((i) => i.watchId)),
  },

  actions: {
    async fetch() {
      const api = useApi();
      try {
        this.items = await api.get<WishlistItemView[]>('/wishlist');
      } catch {
        this.items = [];
      }
      this.loaded = true;
    },

    async toggle(watchId: string) {
      const api = useApi();
      if (this.ids.has(watchId)) {
        await api.del(`/wishlist/${watchId}`);
        this.items = this.items.filter((i) => i.watchId !== watchId);
      } else {
        await api.post('/wishlist', { watchId });
        await this.fetch();
      }
    },

    has(watchId: string) {
      return this.ids.has(watchId);
    },
  },
});
