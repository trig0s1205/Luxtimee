<script setup lang="ts">
import { useWatchBulkDraftStore } from '~/stores/watch-bulk-draft';

const store = useWatchBulkDraftStore();
const open = ref(false);
const input = ref<HTMLInputElement | null>(null);

onMounted(() => {
  store.hydrate();
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
</script>

<template>
  <div class="admin-bulk-draft">
    <UiLuxButton @click="open = true">Carga por fotos</UiLuxButton>
    <p v-if="store.preparing" class="admin-pagination-info">{{ store.prepareLabel || 'Revisando fotos…' }}</p>
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
      <div class="admin-modal admin-bulk-draft-modal">
        <header class="admin-bulk-draft-head">
          <h2>Carga masiva de borradores</h2>
          <button type="button" class="admin-pagination-btn" @click="close">Cerrar</button>
        </header>
        <p class="admin-bulk-draft-copy">
          Sube un ZIP o elige fotos sueltas. Se ordenan por fecha, de la más antigua a la más nueva, aunque la diferencia sea de milisegundos. Si coinciden, se respeta el orden de la carpeta. La impar es el frente y la par el dorso.
          JPEG, PNG o WEBP, máximo 10 MB cada una y 500 fotos. Los borradores quedan en pendientes de información y no se publican.
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
        <p v-if="store.pendingCount" class="admin-pagination-info">
          Puedes cerrar esta ventana: la carga sigue y se reanuda si recargas la página.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.admin-bulk-draft-modal {
  padding: 24px;
  gap: 12px;
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

.admin-bulk-draft-list {
  list-style: none;
  width: 100%;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
  border: var(--border-hairline);
}

.admin-bulk-draft-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--lux-white);
}

.admin-bulk-draft-row--error {
  color: #ff5555;
}
</style>
