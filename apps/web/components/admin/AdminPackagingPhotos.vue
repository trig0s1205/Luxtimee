<script setup lang="ts">
import type { PackagingPhotoDto } from '@luxtime/shared';
import { MAX_PACKAGING_CAPTION, MAX_PACKAGING_PHOTOS, MAX_WATCH_IMAGE_BYTES } from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { authFetchHeaders } from '~/utils/auth-token';

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { confirm } = useConfirm();
const { resolve: resolveMedia } = useMediaUrl();

const photos = ref<PackagingPhotoDto[]>([]);
const drafts = ref<Record<string, string>>({});
const loading = ref(true);
const uploading = ref(false);
const moving = ref(false);
const deletingId = ref<string | null>(null);
const loadError = ref('');

function applyList(list: PackagingPhotoDto[]) {
  const next: Record<string, string> = {};
  for (const photo of list) {
    next[photo.id] = drafts.value[photo.id] ?? photo.caption ?? '';
  }
  drafts.value = next;
  photos.value = list;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    applyList(await api.get<PackagingPhotoDto[]>('/settings/packaging'));
  } catch (err: unknown) {
    loadError.value = extractApiErrorMessage(err, 'No se pudieron cargar las fotos de empaque.');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

function roomLeft() {
  return Math.max(0, MAX_PACKAGING_PHOTOS - photos.value.length);
}

async function uploadFiles(files: File[]) {
  const uploadBase = useApiUploadUrl().replace(/\/$/, '');
  const crossOrigin = /^https?:\/\//i.test(uploadBase) && !uploadBase.startsWith('/');

  async function post(token: string) {
    const body = new FormData();
    for (const file of files) body.append('images', file);
    return fetch(`${uploadBase}/settings/packaging`, {
      method: 'POST',
      body,
      credentials: crossOrigin ? 'omit' : 'include',
      headers: authFetchHeaders(token),
    });
  }

  let token = await auth.ensureUploadToken();
  let res = await post(token);
  if (res.status === 401) {
    token = await auth.ensureUploadToken(true);
    res = await post(token);
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { message?: unknown } | null;
    const apiMessage = Array.isArray(payload?.message)
      ? payload.message.find((item) => typeof item === 'string')
      : payload?.message;
    throw new Error(
      typeof apiMessage === 'string' && apiMessage.trim()
        ? apiMessage
        : 'No se pudieron subir las fotos.',
    );
  }
  const data = await res.json() as PackagingPhotoDto[];
  if (!Array.isArray(data)) throw new Error('Respuesta inválida');
  applyList(data);
}

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = [...(input.files ?? [])];
  input.value = '';
  if (!selected.length || uploading.value) return;

  const images = selected.filter((file) => (
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    || /\.(jpe?g|png|webp)$/i.test(file.name)
  ));
  if (!images.length) {
    toast.error('Usa fotos JPG, PNG o WEBP.');
    return;
  }
  if (images.some((file) => file.size > MAX_WATCH_IMAGE_BYTES)) {
    toast.error('Cada foto debe pesar 10 MB o menos.');
    return;
  }

  const room = roomLeft();
  if (room <= 0) {
    toast.warning(`El máximo es ${MAX_PACKAGING_PHOTOS} fotos. Elimina una para subir otra.`);
    return;
  }
  const batch = images.slice(0, room);
  if (images.length > room) {
    toast.warning(`Solo se subirán ${room} foto(s). El máximo es ${MAX_PACKAGING_PHOTOS}.`);
  }

  uploading.value = true;
  try {
    await uploadFiles(batch);
    toast.success(batch.length === 1 ? 'Foto de empaque guardada.' : `${batch.length} fotos guardadas.`);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron subir las fotos.'));
  } finally {
    uploading.value = false;
  }
}

async function commitCaption(photo: PackagingPhotoDto) {
  const next = (drafts.value[photo.id] ?? '').trim().slice(0, MAX_PACKAGING_CAPTION);
  drafts.value = { ...drafts.value, [photo.id]: next };
  if (next === (photo.caption ?? '')) return;
  try {
    const list = await api.patch<PackagingPhotoDto[]>(`/settings/packaging/${photo.id}`, { caption: next });
    applyList(list);
    const saved = list.find((item) => item.id === photo.id);
    drafts.value = { ...drafts.value, [photo.id]: saved?.caption ?? '' };
  } catch (err: unknown) {
    drafts.value = { ...drafts.value, [photo.id]: photo.caption ?? '' };
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar el texto.'));
  }
}

async function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (moving.value || target < 0 || target >= photos.value.length) return;
  const previous = photos.value.slice();
  const next = previous.slice();
  const [item] = next.splice(index, 1);
  if (!item) return;
  next.splice(target, 0, item);
  photos.value = next;
  moving.value = true;
  try {
    applyList(await api.patch<PackagingPhotoDto[]>('/settings/packaging/order', {
      ids: next.map((photo) => photo.id),
    }));
  } catch (err: unknown) {
    photos.value = previous;
    toast.error(extractApiErrorMessage(err, 'No se pudo cambiar el orden.'));
  } finally {
    moving.value = false;
  }
}

async function remove(photo: PackagingPhotoDto) {
  const ok = await confirm({
    title: '¿Eliminar esta foto de empaque?',
    message: 'Deja de verse en el inicio y en el botón «Ver empaque» de cada reloj.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  deletingId.value = photo.id;
  try {
    applyList(await api.del<PackagingPhotoDto[]>(`/settings/packaging/${photo.id}`));
    toast.success('Foto eliminada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo eliminar la foto.'));
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <div class="pack-admin">
    <div class="pack-admin__toolbar">
      <label class="pack-file" :class="{ 'pack-file--disabled': uploading || roomLeft() === 0 }">
        {{ uploading ? 'Subiendo...' : 'Subir fotos' }}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          :disabled="uploading || roomLeft() === 0"
          @change="onFiles"
        >
      </label>
      <p class="pack-admin__count">{{ photos.length }} de {{ MAX_PACKAGING_PHOTOS }} fotos</p>
    </div>
    <p class="pack-admin__note">
      El texto se guarda al salir del recuadro. Las flechas cambian el orden al instante.
    </p>

    <p v-if="loading" class="pack-admin__note">Cargando fotos…</p>
    <p v-else-if="loadError" class="pack-admin__error">
      {{ loadError }}
      <button type="button" @click="load">Reintentar</button>
    </p>
    <p v-else-if="!photos.length" class="pack-admin__empty">
      Todavía no hay fotos. Cuando subas la primera, los clientes verán «Así llega tu reloj» debajo del catálogo.
    </p>

    <ol v-else class="pack-admin__list">
      <li v-for="(photo, index) in photos" :key="photo.id" class="pack-admin__row">
        <img :src="resolveMedia(photo.imageUrl)" :alt="drafts[photo.id] || `Foto ${index + 1}`">
        <div class="pack-admin__fields">
          <label>
            <span>Texto corto (opcional)</span>
            <input
              v-model="drafts[photo.id]"
              type="text"
              :maxlength="MAX_PACKAGING_CAPTION"
              placeholder="Ej: Caja con paño y pila"
              autocomplete="off"
              @change="commitCaption(photo)"
            >
          </label>
          <small>{{ (drafts[photo.id] ?? '').length }}/{{ MAX_PACKAGING_CAPTION }}</small>
          <div class="pack-admin__actions">
            <button
              type="button"
              aria-label="Mover antes"
              :disabled="moving || index === 0"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Mover después"
              :disabled="moving || index === photos.length - 1"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="pack-admin__delete"
              :disabled="deletingId === photo.id"
              @click="remove(photo)"
            >
              {{ deletingId === photo.id ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.pack-admin__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.pack-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  color: var(--lux-gold);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.pack-file input { display: none; }
.pack-file--disabled { opacity: 0.45; cursor: not-allowed; }

.pack-admin__count,
.pack-admin__note,
.pack-admin__empty {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--lux-white-dim);
}

.pack-admin__error {
  color: #ffb4b4;
  font-size: 12px;
}

.pack-admin__error button,
.pack-admin__actions button {
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: var(--lux-white-dim);
  cursor: pointer;
  padding: 0.35rem 0.55rem;
  font-size: 12px;
}

.pack-admin__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pack-admin__row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.pack-admin__row img {
  width: 120px;
  height: 150px;
  object-fit: cover;
  border: 1px solid rgba(200, 169, 110, 0.2);
  background: rgba(0, 0, 0, 0.04);
}

.pack-admin__fields label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pack-admin__fields span,
.pack-admin__fields small {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.pack-admin__fields input {
  width: 100%;
  background: transparent;
  border: var(--border-hairline);
  color: var(--lux-white);
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
}

.pack-admin__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.pack-admin__delete { color: #f87171; }

.pack-admin__actions button:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 640px) {
  .pack-admin__row { grid-template-columns: 1fr; }
  .pack-admin__row img { width: 100%; height: auto; aspect-ratio: 4 / 5; }
}
</style>
