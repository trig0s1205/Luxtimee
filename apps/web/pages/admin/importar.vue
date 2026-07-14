<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const config = useRuntimeConfig();
const result = ref<{ imported: number; errors: Array<{ row: number; message: string }> } | null>(null);
const loading = ref(false);

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  loading.value = true;
  try {
    const body = new FormData();
    body.append('file', file);
    result.value = await $fetch(`${config.public.apiBaseUrl}/inventory/import`, {
      method: 'POST',
      body,
      credentials: 'include',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <UiSectionHeader label="Operaciones" title="Importar Excel" />
    <p class="text-sm text-lux-white-dim mb-6 -mt-4">
      Descarga la plantilla, complétala y súbela para sincronizar inventario.
    </p>
    <a
      :href="`${config.public.apiBaseUrl}/inventory/import/template`"
      class="inline-block mb-6 text-lux-gold text-xs uppercase tracking-widest"
      target="_blank"
    >
      Descargar plantilla
    </a>
    <input type="file" accept=".xlsx" class="block mb-4 text-sm" @change="onFileChange" />
    <p v-if="loading" class="text-lux-white-dim text-sm">Procesando archivo…</p>
    <div v-if="result" class="border border-lux-gold/15 p-4 text-sm space-y-2">
      <p>Importados: {{ result.imported }}</p>
      <p v-if="result.errors.length" class="text-red-400">Errores:</p>
      <ul v-if="result.errors.length" class="list-disc pl-5 text-red-300">
        <li v-for="err in result.errors" :key="err.row">Fila {{ err.row }}: {{ err.message }}</li>
      </ul>
    </div>
  </div>
</template>
