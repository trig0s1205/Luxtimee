import { defineStore } from 'pinia';
import type { CartItemDto, WatchPublicDto } from '@luxtime/shared';

const STORAGE_KEY = 'LUXTIMEE-cart-wholesale';

export const useWholesaleCartStore = defineStore('wholesale-cart', {
  state: () => ({
    items: [] as CartItemDto[],
    hydrated: false,
  }),

  getters: {
    unitCount: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: (state) => state.items.reduce((sum, item) => {
      const price = item.wholesalePrice ?? item.retailPrice;
      return sum + price * item.quantity;
    }, 0),
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
      const stock = watch.stock ?? 0;
      const existing = this.items.find((i) => i.watchId === watch.id);
      const currentQty = existing?.quantity ?? 0;

      if (stock <= 0 || currentQty + quantity > stock) {
        if (import.meta.client) useStockNotice().show();
        return;
      }

      if (existing) {
        existing.stock = stock;
        existing.quantity += quantity;
      } else {
        this.items.push({
          watchId: watch.id,
          slug: watch.slug,
          productName: `${watch.brand.name} ${watch.model}`,
          productRef: watch.slug,
          productImage: watch.frontImageUrl,
          quantity,
          retailPrice: watch.retailPrice,
          wholesalePrice: watch.wholesalePrice ?? watch.retailPrice,
          stock,
        });
      }
      this.persist();
      if (import.meta.client) {
        useCartDrawer().openCart('wholesale');
      }
    },

    setQuantity(watchId: string, quantity: number) {
      this.hydrate();
      const item = this.items.find((i) => i.watchId === watchId);
      if (!item) return;
      if (quantity <= 0) {
        this.remove(watchId);
        return;
      }
      if (quantity > item.stock) {
        if (import.meta.client) useStockNotice().show();
        return;
      }
      item.quantity = quantity;
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
      return item.wholesalePrice ?? item.retailPrice;
    },

    toCheckoutItems() {
      return this.items.map((item) => ({
        watchId: item.watchId,
        quantity: item.quantity,
        deliveryNote: item.deliveryNote?.trim() || undefined,
      }));
    },

    setDeliveryNote(watchId: string, deliveryNote: string) {
      this.hydrate();
      const item = this.items.find((i) => i.watchId === watchId);
      if (!item) return;
      item.deliveryNote = deliveryNote;
      this.persist();
    },
  },
});
