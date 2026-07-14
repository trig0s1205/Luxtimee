<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
const api = useApi();
const { data: customers, refresh } = await useAsyncData('segments', () => api.get('/segmentation/customers'));

async function suggest(id: string) {
  await api.post(`/segmentation/customers/${id}/suggest`);
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Marketing" title="Segmentación de clientes" />
    <div class="overflow-x-auto border border-lux-gold/10">
      <table class="w-full text-sm">
        <thead class="text-left text-[10px] uppercase tracking-widest text-lux-white-dim border-b border-lux-gold/10">
          <tr><th class="p-3">Cliente</th><th class="p-3">Email</th><th class="p-3">Segmento</th><th class="p-3" /></tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id" class="border-b border-lux-gold/5">
            <td class="p-3">{{ c.name }}</td>
            <td class="p-3">{{ c.email }}</td>
            <td class="p-3">{{ c.segment ?? '—' }}</td>
            <td class="p-3"><button type="button" class="text-lux-gold text-xs uppercase" @click="suggest(c.id)">Sugerir</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
