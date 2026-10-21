import { defineStore } from 'pinia';
import type { CartItemDto, WatchPublicDto } from '@luxtime/shared';

const STORAGE_KEY = 'LUXTIMEE-cart-wholesale';

export type WholesaleCartExtra = { extraId: string; name: string; quantity: number };

export const useWholesaleCartStore = defineStore('wholesale-cart', {
  state: () => ({
    items: [] as CartItemDto[],
    hydrated: false,
  }),

  getters: {
    unitCount: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: (state) => state.items.reduce((sum, item) => {
      const price = item.quotedUnitPrice ?? item.wholesalePrice ?? item.retailPrice;
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
      const slim = this.items.map(({ quotedUnitPrice: _quoted, ...item }) => item);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    },

    addFromWatch(watch: WatchPublicDto, quantity = 1, extras: WholesaleCartExtra[] = []) {
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
        if (extras.length) existing.extras = extras;
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
          extras,
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
      return item.quotedUnitPrice ?? item.wholesalePrice ?? item.retailPrice;
    },

    setExtra(watchId: string, extra: WholesaleCartExtra) {
      this.hydrate();
      const item = this.items.find((row) => row.watchId === watchId);
      if (!item) return;
      const extras = [...(item.extras ?? [])];
      const index = extras.findIndex((row) => row.extraId === extra.extraId);
      if (extra.quantity <= 0) {
        if (index >= 0) extras.splice(index, 1);
      } else if (index >= 0) {
        extras[index] = extra;
      } else {
        extras.push(extra);
      }
      item.extras = extras;
      item.quotedUnitPrice = undefined;
      this.persist();
    },

    applyQuote(lines: Array<{ watchId: string; unitPrice: number }>) {
      let changed = false;
      for (const item of this.items) {
        const line = lines.find((row) => row.watchId === item.watchId);
        const next = line?.unitPrice;
        if (item.quotedUnitPrice !== next) {
          item.quotedUnitPrice = next;
          changed = true;
        }
      }
      if (changed) this.persist();
    },

    toCheckoutItems() {
      return this.items.map((item) => ({
        watchId: item.watchId,
        quantity: item.quantity,
        deliveryNote: item.deliveryNote?.trim() || undefined,
        extras: (item.extras ?? [])
          .filter((extra) => extra.quantity > 0)
          .map((extra) => ({ extraId: extra.extraId, quantity: extra.quantity })),
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
