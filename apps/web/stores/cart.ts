import { defineStore } from 'pinia';
import type { CartItemDto, OrderType, WatchPublicDto } from '@luxtime/shared';
import { WHOLESALE_MIN_UNITS } from '@luxtime/shared';

const STORAGE_KEY = 'luxtime-cart';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItemDto[],
    hydrated: false,
  }),

  getters: {
    unitCount: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    orderType(): OrderType {
      return this.unitCount >= WHOLESALE_MIN_UNITS ? 'MAYORISTA' : 'DETAL';
    },
    subtotal: (state) => {
      const store = useCartStore();
      return state.items.reduce((sum, item) => {
        const price = store.orderType === 'MAYORISTA' ? item.wholesalePrice : item.retailPrice;
        return sum + price * item.quantity;
      }, 0);
    },
    itemCount: (state) => state.items.length,
  },

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) this.items = JSON.parse(raw) as CartItemDto[];
      } catch {
        this.items = [];
      }
      this.hydrated = true;
    },

    persist() {
      if (!import.meta.client) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    },

    addFromWatch(watch: WatchPublicDto, quantity = 1) {
      this.hydrate();
      const existing = this.items.find((i) => i.watchId === watch.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, watch.stock || existing.quantity + quantity);
      } else {
        this.items.push({
          watchId: watch.id,
          slug: watch.slug,
          productName: `${watch.brand.name} ${watch.model}`,
          productRef: watch.slug,
          productImage: watch.frontImageUrl,
          quantity: Math.min(quantity, watch.stock || quantity),
          retailPrice: watch.retailPrice,
          wholesalePrice: watch.wholesalePrice,
          stock: watch.stock,
        });
      }
      this.persist();
    },

    setQuantity(watchId: string, quantity: number) {
      this.hydrate();
      const item = this.items.find((i) => i.watchId === watchId);
      if (!item) return;
      if (quantity <= 0) {
        this.remove(watchId);
        return;
      }
      item.quantity = Math.min(quantity, item.stock || quantity);
      this.persist();
    },

    remove(watchId: string) {
      this.hydrate();
      this.items = this.items.filter((i) => i.watchId !== watchId);
      this.persist();
    },

    clear() {
      this.items = [];
      this.persist();
    },

    unitPrice(item: CartItemDto) {
      return this.orderType === 'MAYORISTA' ? item.wholesalePrice : item.retailPrice;
    },

    toCheckoutItems() {
      return this.items.map((item) => ({
        watchId: item.watchId,
        quantity: item.quantity,
      }));
    },
  },
});
