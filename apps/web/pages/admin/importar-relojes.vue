<script setup lang="ts">
useHead({ title: 'Importar relojes — LUXTIMEE Admin' });
definePageMeta({ middleware: ['admin'] });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

type FieldIssue = { field: string; message: string };
type PreviewRow = {
  rowNumber: number;
  importKey: string;
  status: 'ok' | 'error' | 'ejemplo' | 'ya-importado';
  errors: FieldIssue[];
  warnings: FieldIssue[];
  normalized: Record<string, unknown>;
  skuPrefixEstimado: string | null;
};
type PreviewResult = {
  rows: PreviewRow[];
  summary: {
    ok: number;
    error: number;
    ejemplo: number;
    yaImportado: number;
    catalogReady: number;
    posSellable: number;
  };
};

const file = ref<File | null>(null);
const loading = ref(false);
const committing = ref(false);
const preview = ref<PreviewResult | null>(null);
const onlyErrors = ref(false);
const commitResults = ref<
  Array<{ importKey: string; ok: boolean; sku?: string; watchId?: string; error?: string }>
>([]);

const visibleRows = computed(() => {
  const rows = preview.value?.rows ?? [];
  if (!onlyErrors.value) return rows.filter((r) => r.status !== 'ejemplo');
  return rows.filter((r) => r.status === 'error');
});

const canImport = computed(() => (preview.value?.summary.ok ?? 0) > 0);

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  preview.value = null;
  commitResults.value = [];
}

async function runPreview() {
  if (!file.value) {
    toast.error('Elige un archivo .xlsx o .csv');
    return;
  }
  loading.value = true;
  commitResults.value = [];
  try {
    const body = new FormData();
    body.append('file', file.value);
    preview.value = await api.post<PreviewResult>('/watches/import/preview', body);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'No se pudo leer el archivo');
  } finally {
    loading.value = false;
  }
}

async function runCommit() {
  if (!file.value || !canImport.value) return;
  const n = preview.value!.summary.ok;
  const ok = await confirm({
    title: 'Importar relojes',
    message: `Se crearán ${n} reloj(es). ¿Continuar?`,
  });
  if (!ok) return;
  committing.value = true;
  try {
    const body = new FormData();
    body.append('file', file.value);
    body.append('confirm', 'true');
    commitResults.value = await api.post('/watches/import/commit', body);
    toast.success('Importación terminada');
    await runPreview();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falló la importación');
  } finally {
    committing.value = false;
  }
}

function statusClass(status: PreviewRow['status']) {
  if (status === 'ok') return 'text-emerald-700';
  if (status === 'error') return 'text-red-700';
  if (status === 'ya-importado') return 'text-amber-700';
  return 'text-neutral-500';
}

function downloadSkuCsv() {
  const lines = ['importKey,sku,watchId'];
  for (const r of commitResults.value) {
    if (!r.ok || !r.sku) continue;
    lines.push(`${r.importKey},${r.sku},${r.watchId ?? ''}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sku-asignados.csv';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="admin-page space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-semibold">Importar relojes</h1>
      <p class="mt-1 text-sm text-neutral-600">
        Sube la plantilla Excel/CSV (máx. 2 MB, 300 filas). Primero vista previa; luego importa solo las filas OK.
      </p>
    </header>

    <div class="flex flex-wrap items-end gap-3">
      <label class="block text-sm">
        Archivo
        <input type="file" accept=".xlsx,.csv" class="mt-1 block" @change="onFile" />
      </label>
      <button
        type="button"
        class="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        :disabled="!file || loading"
        @click="runPreview"
      >
        {{ loading ? 'Leyendo…' : 'Vista previa' }}
      </button>
      <button
        type="button"
        class="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        :disabled="!canImport || committing"
        @click="runCommit"
      >
        {{ committing ? 'Importando…' : `Importar ${preview?.summary.ok ?? 0} relojes` }}
      </button>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="onlyErrors" type="checkbox" />
        Solo con errores
      </label>
    </div>

    <p v-if="preview" class="text-sm text-neutral-700">
      OK {{ preview.summary.ok }} · errores {{ preview.summary.error }} · ya importados
      {{ preview.summary.yaImportado }} · listos catálogo {{ preview.summary.catalogReady }} ·
      vendibles POS {{ preview.summary.posSellable }}
    </p>

    <div v-if="visibleRows.length" class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b">
            <th class="py-2 pr-3">Fila</th>
            <th class="py-2 pr-3">Nº</th>
            <th class="py-2 pr-3">Modelo</th>
            <th class="py-2 pr-3">Marca</th>
            <th class="py-2 pr-3">Precio</th>
            <th class="py-2 pr-3">Stock</th>
            <th class="py-2 pr-3">Estado</th>
            <th class="py-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.rowNumber" class="border-b align-top">
            <td class="py-2 pr-3">{{ row.rowNumber }}</td>
            <td class="py-2 pr-3">{{ row.importKey }}</td>
            <td class="py-2 pr-3">{{ row.normalized.model }}</td>
            <td class="py-2 pr-3">—</td>
            <td class="py-2 pr-3">{{ row.normalized.retailPrice }}</td>
            <td class="py-2 pr-3">{{ row.normalized.stock }}</td>
            <td class="py-2 pr-3" :class="statusClass(row.status)">{{ row.status }}</td>
            <td class="py-2">
              <ul v-if="row.errors.length" class="list-disc pl-4 text-red-700">
                <li v-for="(e, i) in row.errors" :key="i">{{ e.field }}: {{ e.message }}</li>
              </ul>
              <ul v-if="row.warnings.length" class="list-disc pl-4 text-amber-700">
                <li v-for="(w, i) in row.warnings" :key="'w'+i">{{ w.field }}: {{ w.message }}</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="commitResults.length" class="space-y-2">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-medium">SKU asignados</h2>
        <button type="button" class="text-sm underline" @click="downloadSkuCsv">Descargar CSV</button>
      </div>
      <ul class="text-sm">
        <li v-for="r in commitResults" :key="r.importKey">
          {{ r.importKey }} →
          <template v-if="r.ok && r.sku">{{ r.sku }}</template>
          <template v-else>{{ r.error || 'error' }}</template>
        </li>
      </ul>
    </div>
  </div>
</template>
