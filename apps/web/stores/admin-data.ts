import { defineStore } from 'pinia';
import type { ShippingZoneDto } from '@luxtime/shared';
import {
  ADMIN_CACHE_MS,
  readSessionAdminCache,
  writeSessionAdminCache,
} from '~/utils/admin-cache';

export const useAdminDataStore = defineStore('adminData', {
  state: () => ({
    zones: [] as ShippingZoneDto[],
    zonesLoadedAt: 0,
    loadingZones: false,
  }),
  getters: {
    zonesStale: (state) => Date.now() - state.zonesLoadedAt > ADMIN_CACHE_MS.reference,
  },
  actions: {
    async ensureZones(fetcher: () => Promise<ShippingZoneDto[]>) {
      if (!this.zonesStale && this.zones.length) return;
      if (this.loadingZones) return;

      const cached = readSessionAdminCache<ShippingZoneDto[]>('zones', ADMIN_CACHE_MS.reference);
      if (cached) {
        this.zones = cached;
        this.zonesLoadedAt = Date.now();
        return;
      }

      this.loadingZones = true;
      try {
        this.zones = await fetcher();
        this.zonesLoadedAt = Date.now();
        writeSessionAdminCache('zones', this.zones);
      } catch {
        if (!this.zones.length) this.zones = [];
      } finally {
        this.loadingZones = false;
      }
    },
    invalidateZones() {
      this.zonesLoadedAt = 0;
    },
  },
});
