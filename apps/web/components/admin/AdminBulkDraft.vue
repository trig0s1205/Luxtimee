<script setup lang="ts">
import {
  ZIP_NO_CREATED_AT_WARNING,
  partialCreatedAtWarning,
  type PhotoSortSource,
} from '@luxtime/shared';
import { useWatchBulkDraftStore } from '~/stores/watch-bulk-draft';

const PREVIEW_LIMIT = 20;

const store = useWatchBulkDraftStore();
const open = ref(false);
const input = ref<HTMLInputElement | null>(null);
const showAll = ref(false);

onMounted(() => {
  store.hydrate();
});

watch(
  () => store.preview,
  (preview) => {
    showAll.value = false;
    if (preview) open.value = true;
  },
);

const visiblePairs = computed(() => {
  const pairs = store.preview?.pairs ?? [];
  return showAll.value ? pairs : pairs.slice(0, PREVIEW_LIMIT);
});

function close() {
  open.value = false;
}

function pickFiles() {
  if (store.preparing) return;
  input.value?.click();
}

function onPick(event: Event) {
  const list = (event.target as HTMLInputElement).files;
  if (!list?.length) return;
  void store.begin(Array.from(list));
  if (input.value) input.value.value = '';
}

function sortLabel(ms: number | undefined, source: PhotoSortSource, loose: boolean) {
  const when = formatSortMs(ms);
  if (source === 'createdAt') return `${when} · creación NTFS`;
  if (source === 'modifiedAt') {
    return loose ? `${when} · lastModified del navegador` : `${when} · modificación`;
  }
  return when;
}

function formatSortMs(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return 'sin fecha';
  const date = new Date(ms);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
</script>

<template>
  <div class="admin-bulk-draft">
    <UiLuxButton @click="open = true">Carga por fotos</UiLuxButton>
    <p v-if="store.preparing" class="admin-pagination-info">{{ store.prepareLabel || 'Revisando fotos…' }}</p>
    <p v-else-if="store.preview && !open" class="admin-pagination-info">
      Hay {{ store.preview.pairs.length }} pares sin confirmar. Ábrelos para revisarlos: no se sube nada hasta confirmar.
    </p>
    <button
      v-if="store.failedCount && !open"
      type="button"
      class="admin-pagination-btn"
      @click="store.retryFailed()"
    >
      Reintentar todas
    </button>
    <ul v-if="store.activeJobs.length" class="admin-bulk-draft-list">
      <li
        v-for="job in store.activeJobs"
        :key="job.id"
        :class="{ 'admin-bulk-draft-row--error': job.status === 'error' }"
      >
        <span>{{ job.frontName }} + {{ job.backName }}</span>
        <span class="admin-watch-progress" :class="{ 'admin-watch-progress--error': job.status === 'error' }">
          <span :style="{ width: `${job.progress}%` }" />
        </span>
        <button
          v-if="job.status === 'error'"
          type="button"
          class="admin-pagination-btn"
          @click="store.retry(job.id)"
        >
          Reintentar
        </button>
      </li>
    </ul>
  </div>

  <Teleport to="body">
    <div v-if="open" class="admin-modal-backdrop" @click.self="close">
      <div class="admin-modal admin-bulk-draft-modal" :class="{ 'admin-modal--wide': store.preview }">
        <header class="admin-bulk-draft-head">
          <h2>{{ store.preview ? 'Confirmar pares' : 'Carga masiva de borradores' }}</h2>
          <button type="button" class="admin-pagination-btn" @click="close">Cerrar</button>
        </header>

        <template v-if="store.preview">
          <p v-if="store.preview.noCreatedAt" class="admin-bulk-draft-warn">
            {{ ZIP_NO_CREATED_AT_WARNING }}
          </p>
          <p v-else-if="store.preview.missingCreatedAt.length" class="admin-bulk-draft-warn admin-bulk-draft-missing">
            {{ partialCreatedAtWarning(store.preview.missingCreatedAt) }}
          </p>
          <p v-if="store.preview.source === 'loose'" class="admin-bulk-draft-copy">
            Fotos sueltas: el navegador solo entrega lastModified, no la hora en que se guardaron en la carpeta. Para WhatsApp conviene el ZIP del Explorador de Windows.
          </p>
          <p v-if="store.largeZipWarning" class="admin-bulk-draft-warn">
            Este ZIP pesa más de 200 MB. Si falla la lectura, vuelve a intentarlo con las fotos sueltas.
          </p>
          <p class="admin-bulk-draft-copy">
            {{ store.preview.pairs.length }} pares, de la más antigua a la más nueva. La primera es el frente y la segunda el dorso. Si un par salió al revés, intercámbialo. Nada se sube hasta que confirmes.
          </p>
          <ol class="admin-bulk-draft-preview">
            <li v-for="(pair, index) in visiblePairs" :key="pair.id">
              <span class="admin-bulk-draft-index">{{ index + 1 }}</span>
              <figure class="admin-bulk-draft-shot">
                <img :src="pair.frontUrl" :alt="`Frente ${pair.frontName}`" />
                <figcaption>
                  <strong>Frente</strong>
                  <span>{{ pair.frontName }}</span>
                  <small>{{ sortLabel(pair.frontSortAt, pair.frontSortSource, store.preview.source === 'loose') }}</small>
                </figcaption>
              </figure>
              <button
                type="button"
                class="admin-bulk-draft-swap"
                :disabled="store.confirming"
                aria-label="Intercambiar frente y dorso"
                @click="store.swapPreviewPair(pair.id)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M7 7h11M15 4l3 3-3 3" />
                  <path d="M17 17H6M9 14l-3 3 3 3" />
                </svg>
              </button>
              <figure class="admin-bulk-draft-shot">
                <img :src="pair.backUrl" :alt="`Dorso ${pair.backName}`" />
                <figcaption>
                  <strong>Dorso</strong>
                  <span>{{ pair.backName }}</span>
                  <small>{{ sortLabel(pair.backSortAt, pair.backSortSource, store.preview.source === 'loose') }}</small>
                </figcaption>
              </figure>
            </li>
          </ol>
          <button
            v-if="store.preview.pairs.length > visiblePairs.length"
            type="button"
            class="admin-pagination-btn"
            @click="showAll = true"
          >
            Mostrar todos ({{ store.preview.pairs.length }})
          </button>
          <div class="admin-bulk-draft-actions">
            <UiLuxButton variant="ghost" :disabled="store.confirming" @click="store.cancelPreview()">
              Cancelar
            </UiLuxButton>
            <UiLuxButton :disabled="store.confirming" @click="store.confirmPreview()">
              Confirmar y subir
            </UiLuxButton>
          </div>
        </template>

        <template v-else>
          <p class="admin-bulk-draft-copy">
            Guarda las fotos de WhatsApp en una carpeta de Windows, de la más antigua a la más nueva: frente, dorso, frente, dorso. Comprime esa carpeta con el Explorador (clic derecho → Enviar a → Carpeta comprimida) y sube el ZIP. El orden usa la hora de creación NTFS, en milisegundos, de cuando cada foto se guardó en la carpeta. Si a alguna le falta, se usa la de modificación.
          </p>
          <p class="admin-bulk-draft-copy">
            Si eliges fotos sueltas, el navegador solo puede leer lastModified. En descargas de WhatsApp esa hora no es la de la carpeta y los pares pueden cruzarse: para este flujo usa el ZIP. Antes de subir vas a revisar los pares y confirmar. JPEG, PNG o WEBP, máximo 10 MB cada una y 500 fotos. Los borradores quedan en pendientes de información y no se publican.
          </p>
          <p class="admin-bulk-draft-copy">
            Si el ZIP pesa más de 200 MB, elige las fotos sueltas. El navegador lee el ZIP por partes, sin cargarlo entero.
          </p>
          <p v-if="store.largeZipWarning" class="admin-bulk-draft-warn">
            Este ZIP pesa más de 200 MB. Si falla la lectura, vuelve a intentarlo con las fotos sueltas.
          </p>
          <UiLuxButton :disabled="store.preparing" @click="pickFiles">Elegir archivos</UiLuxButton>
          <input
            ref="input"
            type="file"
            multiple
            accept=".zip,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png"
            class="admin-bulk-draft-file"
            :disabled="store.preparing"
            @change="onPick"
          />
          <ul v-if="store.prepareErrors.length" class="admin-bulk-draft-errors">
            <li v-for="(error, index) in store.prepareErrors" :key="`${error.fileName}-${index}`">
              {{ error.message }}
            </li>
          </ul>
          <p v-if="store.pendingCount || store.failedCount" class="admin-pagination-info">
            Puedes cerrar esta ventana o salir de Inventario: la carga sigue. Si recargas la página, se reanuda.
          </p>
          <button
            v-if="store.failedCount"
            type="button"
            class="admin-pagination-btn"
            @click="store.retryFailed()"
          >
            Reintentar todas
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.admin-bulk-draft-modal {
  padding: 24px;
  gap: 12px;
  overflow: auto;
}

.admin-bulk-draft-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.admin-bulk-draft-head h2 {
  margin: 0;
  font-family: var(--lux-font-display, serif);
  font-size: 22px;
  font-weight: 400;
  color: var(--lux-white);
}

.admin-bulk-draft-copy,
.admin-bulk-draft-warn {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--lux-white-dim);
}

.admin-bulk-draft-warn {
  color: #ffb020;
}

.admin-bulk-draft-missing {
  max-height: 96px;
  overflow: auto;
}

.admin-bulk-draft-file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.admin-bulk-draft-errors {
  margin: 0;
  padding-left: 18px;
  color: #ff5555;
  font-size: 13px;
}

.admin-bulk-draft {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.admin-bulk-draft-list,
.admin-bulk-draft-preview {
  list-style: none;
  width: 100%;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
  border: var(--border-hairline);
}

.admin-bulk-draft-preview {
  max-height: min(52vh, 480px);
}

.admin-bulk-draft-list li,
.admin-bulk-draft-preview li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--lux-white);
}

.admin-bulk-draft-preview li {
  grid-template-columns: 28px minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  border-bottom: var(--border-hairline);
}

.admin-bulk-draft-swap {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: transparent;
  color: var(--lux-gold, #c8a96e);
  cursor: pointer;
}

.admin-bulk-draft-swap:hover:not(:disabled) {
  border-color: var(--lux-gold, #c8a96e);
  color: var(--lux-white);
}

.admin-bulk-draft-swap:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.admin-bulk-draft-index {
  font-size: 12px;
  color: var(--lux-white-dim);
  padding-top: 4px;
}

.admin-bulk-draft-shot {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.admin-bulk-draft-shot img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.04);
}

.admin-bulk-draft-shot figcaption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 12px;
  color: var(--lux-white);
}

.admin-bulk-draft-shot strong {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-bulk-draft-shot span,
.admin-bulk-draft-shot small {
  overflow-wrap: anywhere;
}

.admin-bulk-draft-shot small {
  color: var(--lux-white-dim);
}

.admin-bulk-draft-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-bulk-draft-row--error {
  color: #ff5555;
}

@media (max-width: 640px) {
  .admin-bulk-draft-preview li {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  }

  .admin-bulk-draft-index {
    grid-column: 1 / -1;
  }

  .admin-bulk-draft-shot {
    grid-template-columns: 64px minmax(0, 1fr);
  }
}
</style>
