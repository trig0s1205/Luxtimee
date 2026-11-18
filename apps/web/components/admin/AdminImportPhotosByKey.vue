<script setup lang="ts">
import { groupImportMediaFiles } from '~/utils/import-photo-names';
import { compressCatalogImage } from '~/utils/catalog-image';
import { validateWatchVideoFile } from '~/utils/video-validation';

type LookupRow = {
  importKey: string;
  watchId: string | null;
  sku: string | null;
  model: string | null;
  hasFront: boolean;
  hasBack: boolean;
  hasVideo: boolean;
};

type RowState = {
  importKey: string;
  front?: File;
  back?: File;
  video?: File;
  frontUrl?: string;
  backUrl?: string;
  lookup?: LookupRow;
  replace: boolean;
  status: 'idle' | 'ready' | 'falta-dorso' | 'sin-reloj' | 'ya-tiene' | 'uploading' | 'done' | 'error';
  error?: string;
};

const api = useApi();
const toast = useToast();
const mediaUpload = useMediaUploadStore();
const open = ref(false);
const rows = ref<RowState[]>([]);
const ignored = ref<string[]>([]);
const busy = ref(false);

function revoke(url?: string) {
  if (url) URL.revokeObjectURL(url);
}

onBeforeUnmount(() => {
  for (const r of rows.value) {
    revoke(r.frontUrl);
    revoke(r.backUrl);
  }
});

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (!files.length) return;

  const grouped = groupImportMediaFiles(files);
  ignored.value = grouped.ignored;
  const keys = grouped.groups.map((g) => g.importKey);
  let lookups: LookupRow[] = [];
  try {
    lookups = await api.get<LookupRow[]>('/watches/by-import-key', {
      keys: keys.join(','),
    });
  } catch {
    toast.error('No se pudo consultar los Nº de carga');
    return;
  }
  const byKey = new Map(lookups.map((l) => [l.importKey, l]));

  for (const r of rows.value) {
    revoke(r.frontUrl);
    revoke(r.backUrl);
  }

  rows.value = grouped.groups.map((g) => {
    const lookup = byKey.get(g.importKey);
    let status: RowState['status'] = 'ready';
    if (!lookup?.watchId) status = 'sin-reloj';
    else if (!g.front) status = 'falta-dorso';
    else if (!g.back) status = 'falta-dorso';
    else if (lookup.hasFront || lookup.hasBack || lookup.hasVideo) status = 'ya-tiene';
    return {
      importKey: g.importKey,
      front: g.front,
      back: g.back,
      video: g.video,
      frontUrl: g.front ? URL.createObjectURL(g.front) : undefined,
      backUrl: g.back ? URL.createObjectURL(g.back) : undefined,
      lookup,
      replace: false,
      status,
    };
  });
  open.value = true;
}

const uploadable = computed(() =>
  rows.value.filter((r) => {
    if (!r.lookup?.watchId || !r.front) return false;
    if (r.status === 'ya-tiene' && !r.replace) return false;
    if (r.status === 'sin-reloj') return false;
    return true;
  }),
);

async function uploadAll() {
  if (!uploadable.value.length) {
    toast.error('No hay relojes listos para subir');
    return;
  }
  busy.value = true;
  try {
    for (const row of uploadable.value) {
      row.status = 'uploading';
      row.error = undefined;
      try {
        if (row.video) {
          const videoErr = await validateWatchVideoFile(row.video);
          if (videoErr) throw new Error(videoErr);
        }
        async function asFile(src: File, name: string) {
          const blob = await compressCatalogImage(src);
          return new File([blob], name, { type: blob.type || src.type });
        }
        const image1 = row.front
          ? await asFile(row.front, row.front.name)
          : undefined;
        const image2 = row.back
          ? await asFile(row.back, row.back.name)
          : undefined;
        mediaUpload.enqueue({
          watchId: row.lookup!.watchId!,
          model: row.lookup?.model || row.importKey,
          brandName: '',
          files: {
            image1,
            image2,
            video: row.video,
          },
        });
        row.status = 'done';
      } catch (err) {
        row.status = 'error';
        row.error = err instanceof Error ? err.message : 'Error';
      }
    }
    toast.success('Fotos en cola de subida');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="admin-import-photos">
    <label class="admin-pagination-btn" style="cursor: pointer">
      Fotos por Nº
      <input type="file" class="sr-only" multiple accept="image/*,video/mp4" @change="onPick" />
    </label>

    <div v-if="open" class="admin-import-photos-panel">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium">Fotos por Nº de carga</h3>
        <button type="button" class="text-sm underline" @click="open = false">Cerrar</button>
      </div>
      <p v-if="ignored.length" class="text-sm text-amber-700">
        Ignorados: {{ ignored.join(', ') }}
      </p>
      <ul class="space-y-3">
        <li v-for="row in rows" :key="row.importKey" class="border-b pb-2 text-sm">
          <div class="flex flex-wrap items-center gap-3">
            <strong>{{ row.importKey }}</strong>
            <span>{{ row.lookup?.model || '—' }}</span>
            <span>{{ row.lookup?.sku || 'sin reloj' }}</span>
            <span>{{ row.status }}</span>
            <label v-if="row.status === 'ya-tiene' || (row.lookup?.hasFront && row.replace !== undefined)" class="flex items-center gap-1">
              <input v-model="row.replace" type="checkbox" />
              reemplazar
            </label>
          </div>
          <div class="mt-2 flex gap-2">
            <img v-if="row.frontUrl" :src="row.frontUrl" alt="frente" class="h-16 w-16 object-cover" />
            <img v-if="row.backUrl" :src="row.backUrl" alt="dorso" class="h-16 w-16 object-cover" />
          </div>
          <p v-if="row.error" class="text-red-700">{{ row.error }}</p>
        </li>
      </ul>
      <button
        type="button"
        class="mt-3 rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        :disabled="busy || !uploadable.length"
        @click="uploadAll"
      >
        {{ busy ? 'Encolando…' : `Subir ${uploadable.length}` }}
      </button>
    </div>
  </div>
</template>
