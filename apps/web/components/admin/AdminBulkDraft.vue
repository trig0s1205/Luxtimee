<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { selectionBadge } from '~/utils/bulk-photo-arrange';
import { useWatchBulkDraftStore } from '~/stores/watch-bulk-draft';

const Draggable = defineAsyncComponent(() => import('vuedraggable'));

const store = useWatchBulkDraftStore();
const open = ref(false);
const narrow = ref(false);
const input = ref<HTMLInputElement | null>(null);
const zoomUrl = ref<string | null>(null);
const dragging = ref(false);

function syncNarrow() {
  narrow.value = window.matchMedia('(max-width: 768px)').matches;
}

onMounted(() => {
  store.hydrate();
  syncNarrow();
  window.addEventListener('resize', syncNarrow);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncNarrow);
});

const readyCount = computed(() => store.preview?.pairs.length ?? 0);

function start() {
  if (store.preview || store.board || store.preparing) {
    open.value = true;
    return;
  }
  if (window.matchMedia('(max-width: 768px)').matches) input.value?.click();
  else open.value = true;
}

function onPick(event: Event) {
  const list = (event.target as HTMLInputElement).files;
  if (!list?.length) return;
  open.value = true;
  const mode = window.matchMedia('(max-width: 768px)').matches ? 'sequence' : 'arrange';
  void store.ingest(Array.from(list), mode);
  if (input.value) input.value.value = '';
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!files.length || store.preparing) return;
  open.value = true;
  void store.ingest(files, 'arrange');
}

function badge(id: string) {
  const index = store.selection.indexOf(id);
  if (index < 0) return '';
  const mark = selectionBadge(index);
  return `${mark.n} ${mark.role === 'frente' ? 'Frente' : 'Dorso'}`;
}

function close() {
  open.value = false;
  zoomUrl.value = null;
}
</script>

<template>
  <div class="admin-bulk-draft">
    <UiLuxButton @click="start">Carga por fotos</UiLuxButton>
    <p v-if="store.preparing" class="admin-pagination-info">{{ store.prepareLabel || 'Preparando fotos…' }}</p>
    <p v-else-if="store.preview && !open" class="admin-pagination-info">
      Hay {{ readyCount }} relojes sin subir. Ábrelos para revisarlos.
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
        <span>{{ job.backName ? `${job.frontName} + ${job.backName}` : job.frontName }}</span>
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
    <input
      ref="input"
      type="file"
      multiple
      accept="image/*"
      class="admin-bulk-draft-file"
      :disabled="store.preparing"
      @change="onPick"
    />
  </div>

  <Teleport to="body">
    <div v-if="open" class="admin-modal-backdrop" @click.self="close">
      <div class="admin-modal admin-bulk-draft-modal" :class="{ 'admin-modal--wide': !!store.preview || !!store.board }">
        <header class="admin-bulk-draft-head">
          <h2>{{ store.preview ? 'Revisar relojes' : store.board ? 'Armar pares' : 'Carga masiva de fotos' }}</h2>
          <button type="button" class="admin-pagination-btn" @click="close">Cerrar</button>
        </header>

        <p v-if="store.preparing" class="admin-pagination-info">{{ store.prepareLabel || 'Preparando fotos…' }}</p>

        <template v-else-if="store.preview">
          <p class="admin-bulk-draft-copy">{{ readyCount }} relojes listos. Nada se sube hasta pulsar Subir todo.</p>
          <p v-if="store.preview.orphan" class="admin-bulk-draft-warn">
            Quedó una foto sin par: {{ store.preview.orphan.name }}. Puedes subirla solo con frente o descartarla.
          </p>
          <div v-if="store.preview.orphan" class="admin-bulk-draft-orphan">
            <img :src="store.preview.orphan.url" alt="" />
            <button type="button" class="admin-pagination-btn" @click="store.acceptOrphan()">Subir solo con frente</button>
            <button type="button" class="admin-pagination-btn" @click="store.discardOrphan()">Descartar</button>
          </div>
          <Draggable
            :list="store.preview.pairs"
            item-key="id"
            tag="ol"
            class="admin-bulk-draft-preview"
            handle=".admin-bulk-draft-handle"
            :disabled="narrow || store.confirming"
            @end="store.persistPreviewOrder()"
          >
            <template #item="{ element: pair, index }">
              <li>
                <button v-if="!narrow" type="button" class="admin-bulk-draft-handle" aria-label="Arrastrar">⋮⋮</button>
                <span class="admin-bulk-draft-index">{{ index + 1 }}</span>
                <figure class="admin-bulk-draft-shot">
                  <img :src="pair.frontUrl" :alt="`Frente ${pair.frontName}`" />
                  <figcaption>
                    <strong>Frente</strong>
                    <span>{{ pair.frontName }}</span>
                    <button type="button" class="admin-pagination-btn" @click="store.removePreviewPhoto(pair.id, 'front')">Quitar foto</button>
                  </figcaption>
                </figure>
                <button
                  type="button"
                  class="admin-bulk-draft-swap"
                  :disabled="store.confirming || !pair.backUrl"
                  aria-label="Intercambiar frente y dorso"
                  @click="store.swapPreviewPair(pair.id)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M7 7h11M15 4l3 3-3 3" />
                    <path d="M17 17H6M9 14l-3 3 3 3" />
                  </svg>
                </button>
                <figure class="admin-bulk-draft-shot">
                  <img v-if="pair.backUrl" :src="pair.backUrl" :alt="`Dorso ${pair.backName}`" />
                  <div v-else class="admin-bulk-draft-empty">Sin dorso</div>
                  <figcaption>
                    <strong>Dorso</strong>
                    <span>{{ pair.backName || '—' }}</span>
                    <button
                      v-if="pair.backUrl"
                      type="button"
                      class="admin-pagination-btn"
                      @click="store.removePreviewPhoto(pair.id, 'back')"
                    >
                      Quitar foto
                    </button>
                  </figcaption>
                </figure>
                <div class="admin-bulk-draft-row-actions">
                  <button type="button" class="admin-pagination-btn" :disabled="index === 0" @click="store.movePreview(pair.id, -1)">Subir</button>
                  <button type="button" class="admin-pagination-btn" :disabled="index === store.preview.pairs.length - 1" @click="store.movePreview(pair.id, 1)">Bajar</button>
                  <button type="button" class="admin-pagination-btn" @click="store.removePreviewWatch(pair.id)">Quitar reloj</button>
                </div>
              </li>
            </template>
          </Draggable>
          <div class="admin-bulk-draft-actions">
            <UiLuxButton variant="ghost" :disabled="store.confirming" @click="store.cancelPreview()">Cancelar</UiLuxButton>
            <UiLuxButton :disabled="store.confirming || !readyCount" @click="store.confirmPreview()">Subir todo</UiLuxButton>
          </div>
        </template>

        <template v-else-if="store.board">
          <p class="admin-bulk-draft-copy">
            Ordenadas por nombre. Haz clic en el orden frente, dorso, frente, dorso. Un segundo clic quita la foto y renumera el resto.
          </p>
          <div class="admin-bulk-draft-actions">
            <button type="button" class="admin-pagination-btn" @click="store.useBoardOrder()">Usar orden actual</button>
            <button type="button" class="admin-pagination-btn" @click="store.clearSelection()">Limpiar selección</button>
            <UiLuxButton :disabled="!store.selection.length" @click="store.commitBoard()">Continuar</UiLuxButton>
          </div>
          <ul class="admin-bulk-draft-grid">
            <li v-for="photo in store.board" :key="photo.id">
              <button
                type="button"
                class="admin-bulk-draft-tile"
                :class="{ 'is-selected': store.selection.includes(photo.id) }"
                @click="store.toggleBoardPhoto(photo.id)"
              >
                <img :src="photo.url" :alt="photo.name" />
                <span v-if="badge(photo.id)" class="admin-bulk-draft-badge">{{ badge(photo.id) }}</span>
              </button>
              <button type="button" class="admin-pagination-btn" @click="zoomUrl = photo.url">Ver</button>
            </li>
          </ul>
        </template>

        <template v-else>
          <p class="admin-bulk-draft-copy">
            En el celular se abre la galería: toca frente, dorso, frente, dorso. En el computador elige la carpeta o arrastra las fotos; el orden del explorador no se usa.
          </p>
          <div
            v-if="!narrow"
            class="admin-bulk-draft-drop"
            :class="{ 'is-over': dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            Suelta las fotos aquí
          </div>
          <UiLuxButton :disabled="store.preparing" @click="input?.click()">Elegir fotos</UiLuxButton>
          <ul v-if="store.prepareErrors.length" class="admin-bulk-draft-errors">
            <li v-for="(error, index) in store.prepareErrors" :key="`${error.fileName}-${index}`">{{ error.message }}</li>
          </ul>
          <p v-if="store.pendingCount || store.failedCount" class="admin-pagination-info">
            Puedes cerrar esta ventana o salir de Inventario: la carga sigue. Si recargas la página, se reanuda.
          </p>
          <button v-if="store.failedCount" type="button" class="admin-pagination-btn" @click="store.retryFailed()">
            Reintentar todas
          </button>
        </template>

        <ul v-if="store.prepareErrors.length && (store.preview || store.board)" class="admin-bulk-draft-errors">
          <li v-for="(error, index) in store.prepareErrors" :key="`ready-${error.fileName}-${index}`">{{ error.message }}</li>
        </ul>
      </div>
    </div>
    <AdminImageLightbox :src="zoomUrl" @close="zoomUrl = null" />
  </Teleport>
</template>

<style scoped>
.admin-bulk-draft-modal {
  padding: 24px;
  gap: 12px;
  overflow: auto;
  max-width: min(1080px, calc(100vw - 24px));
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

.admin-bulk-draft-drop {
  display: grid;
  place-items: center;
  min-height: 120px;
  border: 1px dashed rgba(200, 169, 110, 0.55);
  color: var(--lux-white-dim);
  font-size: 14px;
}

.admin-bulk-draft-drop.is-over {
  border-color: var(--lux-gold, #c8a96e);
  color: var(--lux-white);
}

.admin-bulk-draft-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  max-height: min(62vh, 640px);
  overflow: auto;
}

.admin-bulk-draft-tile {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.admin-bulk-draft-tile img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.admin-bulk-draft-tile.is-selected {
  border-color: var(--lux-gold, #c8a96e);
}

.admin-bulk-draft-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.72);
  color: var(--lux-white);
  font-size: 12px;
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
  max-height: min(58vh, 640px);
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
  grid-template-columns: auto auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  border-bottom: var(--border-hairline);
}

.admin-bulk-draft-row-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-bulk-draft-handle {
  cursor: grab;
  border: 0;
  background: transparent;
  color: var(--lux-white-dim);
  padding: 8px 4px;
}

.admin-bulk-draft-swap {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-top: 18px;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: transparent;
  color: var(--lux-gold, #c8a96e);
  cursor: pointer;
}

.admin-bulk-draft-swap:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.admin-bulk-draft-index {
  font-size: 12px;
  color: var(--lux-white-dim);
  padding-top: 8px;
}

.admin-bulk-draft-shot {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.admin-bulk-draft-shot img,
.admin-bulk-draft-empty {
  width: 96px;
  height: 96px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.04);
}

.admin-bulk-draft-empty {
  display: grid;
  place-items: center;
  color: var(--lux-white-dim);
  font-size: 11px;
}

.admin-bulk-draft-shot figcaption {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
}

.admin-bulk-draft-shot strong {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-bulk-draft-shot span {
  overflow-wrap: anywhere;
}

.admin-bulk-draft-orphan {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.admin-bulk-draft-orphan img {
  width: 72px;
  height: 72px;
  object-fit: cover;
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

@media (max-width: 768px) {
  .admin-bulk-draft-preview li {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-bulk-draft-shot {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .admin-bulk-draft-shot img,
  .admin-bulk-draft-empty {
    width: 72px;
    height: 72px;
  }
}
</style>
