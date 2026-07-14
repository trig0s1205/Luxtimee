<script setup lang="ts">
import type { WatchStaffDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const { data: products, refresh } = await useAsyncData('admin-products', () =>
  api.get<WatchStaffDto[]>('/products').catch(() => []),
);
</script>

<template>
  <div>
    <UiSectionHeader label="Operaciones" title="Inventario" />
    <p class="text-sm text-lux-white-dim mb-8 -mt-4">Gestión de relojes activos (sin datos financieros para Admin).</p>

    <div class="overflow-x-auto border border-lux-gold/10">
      <table class="w-full text-sm">
        <thead class="text-left text-lux-white-dim uppercase text-[10px] tracking-widest border-b border-lux-gold/10">
          <tr>
            <th class="p-4">Modelo</th>
            <th class="p-4">Marca</th>
            <th class="p-4">Stock</th>
            <th class="p-4">Precio detal</th>
            <th class="p-4">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="watch in products" :key="watch.id" class="border-b border-lux-gold/5">
            <td class="p-4">{{ watch.model }}</td>
            <td class="p-4">{{ watch.brand.name }}</td>
            <td class="p-4">{{ watch.stock }}</td>
            <td class="p-4">{{ formatCop(watch.retailPrice) }}</td>
            <td class="p-4">{{ watch.isActive ? 'Activo' : 'Inactivo' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="mt-4 text-xs uppercase tracking-widest text-lux-gold" @click="refresh()">Actualizar</button>
  </div>
</template>
