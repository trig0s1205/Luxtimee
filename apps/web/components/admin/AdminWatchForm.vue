<script setup lang="ts">
import type { BrandDto, CareTemplateDto, CategoryDto, MechanismDto, WatchStaffDto } from '@luxtime/shared';
import { WatchStatus } from '@luxtime/shared';
import { calcMarginPercent } from '~/utils/margin';
import { validateWatchVideoFile } from '~/utils/video-validation';
import { MAX_VIDEO_DURATION_SEC } from '@luxtime/shared';

type WatchFormPayload = {
  brandId: string;
  categoryId?: string;
  mechanismId?: string;
  movementType?: string;
  model: string;
  description?: string;
  gender?: string;
  warrantyMonths: number;
  careTemplateId?: string;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  profitPercent?: number;
  retailMarginPercentage?: number;
  wholesaleMarginPercentage?: number;
  stock: number;
  status: WatchStatus;
  isLimitedEdition: boolean;
  limitedEditionNumber?: string;
  images: string[];
  mainImageIndex: number;
  primaryImageUrl?: string;
  secondaryImageUrl?: string;
  videoUrl?: string;
  primaryImageFile: File | null;
  secondaryImageFile: File | null;
  videoFile: File | null;
  imagesOnly?: boolean;
};

const props = defineProps<{
  watch?: WatchStaffDto | null;
  brands: BrandDto[];
  categories: CategoryDto[];
  mechanisms: MechanismDto[];
  careTemplates: CareTemplateDto[];
  saving: boolean;
  submitError?: string;
}>();

const emit = defineEmits<{
  submit: [watch: WatchFormPayload];
  cancel: [];
}>();

const auth = useAuthStore();
const toast = useToast();

const activeTab = ref(0);
const tabs = ['GENERAL', 'PRECIOS E INVENTARIO', 'MULTIMEDIA'];

const genderOptions = ['Hombre', 'Mujer', 'Unisex'];

const form = reactive<WatchFormPayload>({
  brandId: props.watch?.brand?.id ?? '',
  categoryId: props.watch?.category?.id ?? '',
  mechanismId: props.watch?.mechanism?.id ?? '',
  movementType: props.watch?.mechanism?.name ?? props.watch?.movementType ?? '',
  model: props.watch?.model ?? '',
  description: props.watch?.description ?? undefined,
  gender: props.watch?.gender ?? undefined,
  warrantyMonths: props.watch?.warrantyMonths ?? 1,
  careTemplateId: props.watch?.careTemplate?.id ?? '',
  retailPrice: props.watch?.retailPrice ?? 0,
  wholesalePrice: props.watch?.wholesalePrice ?? 0,
  cost: props.watch?.cost ?? undefined,
  profitPercent: props.watch?.profitPercent ?? undefined,
  retailMarginPercentage: props.watch?.retailMarginPercentage ?? undefined,
  wholesaleMarginPercentage: props.watch?.wholesaleMarginPercentage ?? undefined,
  stock: props.watch?.stock ?? 0,
  status: props.watch?.status ?? WatchStatus.DISPONIBLE,
  isLimitedEdition: props.watch?.isLimitedEdition ?? false,
  limitedEditionNumber: props.watch?.limitedEditionNumber ?? undefined,
  images: props.watch?.images?.length ? [...props.watch.images] : [],
  mainImageIndex: props.watch?.mainImageIndex ?? 0,
  primaryImageUrl: props.watch?.primaryImageUrl ?? props.watch?.frontImageUrl ?? props.watch?.images?.[0] ?? undefined,
  secondaryImageUrl: props.watch?.secondaryImageUrl ?? props.watch?.images?.[1] ?? undefined,
  videoUrl: props.watch?.videoUrl ?? undefined,
  primaryImageFile: null,
  secondaryImageFile: null,
  videoFile: null,
});

watch(
  () => form.stock,
  (stock) => {
    form.status = stock > 0 ? WatchStatus.DISPONIBLE : WatchStatus.AGOTADO;
  },
  { immediate: true },
);

watch(
  () => form.mechanismId,
  (id) => {
    const mech = props.mechanisms.find((m) => m.id === id);
    form.movementType = mech?.name ?? '';
  },
);

const retailMarginPercentage = computed(() =>
  calcMarginPercent(Number(form.retailPrice), form.cost !== undefined ? Number(form.cost) : null),
);

const wholesaleMarginPercentage = computed(() =>
  calcMarginPercent(Number(form.wholesalePrice), form.cost !== undefined ? Number(form.cost) : null),
);

watch([retailMarginPercentage, wholesaleMarginPercentage], ([retail, wholesale]) => {
  form.retailMarginPercentage = retail ?? undefined;
  form.wholesaleMarginPercentage = wholesale ?? undefined;
  form.profitPercent = retail ?? undefined;
});

const mediaError = ref('');
const imagesOnlyMode = ref(auth.isSuperAdmin && !props.watch?.id);
const primaryInput = ref<HTMLInputElement | null>(null);
const secondaryInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);
const primaryPreview = ref<string | null>(null);
const secondaryPreview = ref<string | null>(null);
const videoPreview = ref<string | null>(null);

function setImageFile(slot: 'primary' | 'secondary', file: File | null) {
  mediaError.value = '';
  if (slot === 'primary') {
    if (primaryPreview.value) URL.revokeObjectURL(primaryPreview.value);
    form.primaryImageFile = file;
    primaryPreview.value = file ? URL.createObjectURL(file) : null;
  } else {
    if (secondaryPreview.value) URL.revokeObjectURL(secondaryPreview.value);
    form.secondaryImageFile = file;
    secondaryPreview.value = file ? URL.createObjectURL(file) : null;
  }
}

function setVideoFile(file: File | null) {
  mediaError.value = '';
  if (videoPreview.value) URL.revokeObjectURL(videoPreview.value);
  form.videoFile = file;
  videoPreview.value = file ? URL.createObjectURL(file) : null;
}

function onImageSelect(slot: 'primary' | 'secondary', event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (file && file.type.startsWith('image/')) setImageFile(slot, file);
  (event.target as HTMLInputElement).value = '';
}

function onVideoSelect(event: Event) {
  void onVideoSelectAsync(event);
}

async function onVideoSelectAsync(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  (event.target as HTMLInputElement).value = '';

  if (!file) return;

  mediaError.value = '';
  const validationError = await validateWatchVideoFile(file);
  if (validationError) {
    mediaError.value = validationError;
    toast.warning(validationError);
    activeTab.value = 2;
    return;
  }

  setVideoFile(file);
  toast.info('Video válido. Se optimizará al guardar (máx. 1080p, ~10 MB).');
}

function clearImageSlot(slot: 'primary' | 'secondary') {
  if (slot === 'primary') {
    setImageFile('primary', null);
    form.primaryImageUrl = undefined;
  } else {
    setImageFile('secondary', null);
    form.secondaryImageUrl = undefined;
  }
}

function clearVideoSlot() {
  setVideoFile(null);
  form.videoUrl = undefined;
}

onUnmounted(() => {
  if (primaryPreview.value) URL.revokeObjectURL(primaryPreview.value);
  if (secondaryPreview.value) URL.revokeObjectURL(secondaryPreview.value);
  if (videoPreview.value) URL.revokeObjectURL(videoPreview.value);
});

function hasRequiredMedia() {
  const hasPrimary = !!(form.primaryImageFile || form.primaryImageUrl);
  const hasSecondary = !!(form.secondaryImageFile || form.secondaryImageUrl);
  const hasVideo = !!(form.videoFile || form.videoUrl);

  if (imagesOnlyMode.value && !isEdit.value) {
    return hasPrimary && hasSecondary;
  }
  if (isEdit.value) {
    return hasPrimary && hasSecondary;
  }
  return hasPrimary && hasSecondary && hasVideo;
}

const isBusy = computed(() => props.saving);
const isEdit = computed(() => !!props.watch?.id);

async function onSubmit() {
  if (isBusy.value) return;

  if (!hasRequiredMedia()) {
    mediaError.value = imagesOnlyMode.value && !isEdit.value
      ? 'Debes cargar foto principal y foto secundaria.'
      : isEdit.value
        ? 'Debes tener foto principal y foto secundaria.'
        : 'Debes cargar foto principal, foto secundaria y video.';
    activeTab.value = 2;
    return;
  }

  if (form.videoFile) {
    const validationError = await validateWatchVideoFile(form.videoFile);
    if (validationError) {
      mediaError.value = validationError;
      toast.warning(validationError);
      activeTab.value = 2;
      return;
    }
  }

  emit('submit', { ...form, imagesOnly: imagesOnlyMode.value });
}

const skuPreview = computed(() => props.watch?.sku ?? 'Se generará automáticamente al guardar');

const selectedCareTemplate = computed(() =>
  props.careTemplates.find((t) => t.id === form.careTemplateId) ?? null,
);
</script>

<template>
  <form class="admin-watch-form" @submit.prevent="onSubmit">
    <div class="admin-watch-form-header">
      <h2 class="admin-watch-form-title">
        {{ isEdit ? 'Editar reloj' : 'Nuevo reloj' }}
      </h2>
      <p v-if="isEdit" class="admin-watch-form-subtitle">SKU: {{ skuPreview }}</p>
    </div>

    <div v-if="submitError" class="admin-form-error-banner" role="alert">
      {{ submitError }}
    </div>

    <div class="admin-watch-tabs">
      <button
        v-for="(tab, i) in tabs"
        :key="tab"
        type="button"
        class="admin-watch-tab"
        :class="{ active: activeTab === i }"
        @click="activeTab = i"
      >
        {{ tab }}
      </button>
    </div>

    <div class="admin-watch-form-body">
      <div v-if="auth.isSuperAdmin && !isEdit" class="admin-images-only-banner">
        <UiLuxCheckbox
          v-model="imagesOnlyMode"
          label="Solo imágenes (borrador) — la secretaria completa datos y video después"
        />
      </div>

      <!-- GENERAL -->
      <div v-show="activeTab === 0" class="admin-watch-tab-panel">
        <div class="admin-form-grid">
          <div class="admin-form-field">
            <label>Marca <span v-if="!imagesOnlyMode || isEdit" class="admin-form-required">*</span></label>
            <select v-model="form.brandId" :required="!imagesOnlyMode || isEdit">
              <option value="" disabled>Seleccionar marca</option>
              <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
            </select>
          </div>

          <div class="admin-form-field">
            <label>Clase / Estilo</label>
            <select v-model="form.categoryId">
              <option value="">Sin clasificar</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
          </div>

          <div class="admin-form-field">
            <label>Mecanismo</label>
            <select v-model="form.mechanismId">
              <option value="">Sin especificar</option>
              <option v-for="mechanism in mechanisms" :key="mechanism.id" :value="mechanism.id">{{ mechanism.name }}</option>
            </select>
          </div>

          <div class="admin-form-field">
            <label>Nombre comercial (modelo) <span v-if="!imagesOnlyMode || isEdit" class="admin-form-required">*</span></label>
            <UiLuxInput v-model="form.model" placeholder="Ej. Submariner Date" />
          </div>

          <div class="admin-form-field">
            <label>Género</label>
            <select v-model="form.gender">
              <option value="" disabled>Seleccionar género</option>
              <option v-for="opt in genderOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>

          <div class="admin-form-field">
            <label>Garantía (Meses)</label>
            <UiLuxInput v-model="form.warrantyMonths" type="number" placeholder="Ej. 1" />
          </div>

          <div class="admin-form-field">
            <label>Cuidados</label>
            <select v-model="form.careTemplateId">
              <option value="">Seleccionar plantilla</option>
              <option v-for="template in careTemplates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
            <p v-if="selectedCareTemplate" class="admin-form-hint">{{ selectedCareTemplate.instructions }}</p>
          </div>

          <div class="admin-form-field admin-form-field--full">
            <label>Descripción</label>
            <textarea
              v-model="form.description"
              rows="5"
              placeholder="Historia y detalles comerciales del modelo..."
            />
          </div>

          <div class="admin-form-field admin-form-field--inline">
            <UiLuxCheckbox v-model="form.isLimitedEdition" label="Edición limitada" />
          </div>

          <div v-if="form.isLimitedEdition" class="admin-form-field">
            <label>Numeración de edición limitada</label>
            <UiLuxInput v-model="form.limitedEditionNumber" placeholder="Ej. 045/100" />
          </div>
        </div>
      </div>

      <!-- PRECIOS E INVENTARIO -->
      <div v-show="activeTab === 1" class="admin-watch-tab-panel">
        <div class="admin-form-grid">
          <div class="admin-form-field">
            <label>SKU</label>
            <input type="text" :value="skuPreview" disabled class="admin-form-readonly">
          </div>

          <div class="admin-form-field">
            <label>Precio público (COP) <span class="admin-form-required">*</span></label>
            <UiLuxInput v-model="form.retailPrice" type="number" placeholder="0" />
          </div>

          <div class="admin-form-field">
            <label>Precio mayorista (COP) <span class="admin-form-required">*</span></label>
            <UiLuxInput v-model="form.wholesalePrice" type="number" placeholder="0" />
          </div>

          <div class="admin-form-field">
            <label>Stock disponible <span class="admin-form-required">*</span></label>
            <UiLuxInput v-model="form.stock" type="number" placeholder="0" />
          </div>

          <div class="admin-form-field">
            <label>Estado calculado</label>
            <input type="text" :value="form.status" disabled class="admin-form-readonly">
          </div>

          <template v-if="auth.isSuperAdmin">
            <div class="admin-form-field">
              <label>Costo (COP)</label>
              <UiLuxInput v-model="form.cost" type="number" placeholder="0" />
            </div>

            <div class="admin-form-field">
              <label>% Margen al detal</label>
              <input
                type="text"
                :value="retailMarginPercentage !== null ? `${retailMarginPercentage}%` : '—'"
                disabled
                class="admin-form-readonly"
              >
            </div>

            <div class="admin-form-field">
              <label>% Margen mayorista</label>
              <input
                type="text"
                :value="wholesaleMarginPercentage !== null ? `${wholesaleMarginPercentage}%` : '—'"
                disabled
                class="admin-form-readonly"
              >
            </div>
          </template>
        </div>
      </div>

      <!-- MULTIMEDIA -->
      <div v-show="activeTab === 2" class="admin-watch-tab-panel">
        <p v-if="imagesOnlyMode && !isEdit" class="admin-form-hint admin-form-hint--media">
          Sube las dos fotos. El video lo agrega la secretaria al editar el reloj.
        </p>
        <p v-if="mediaError" class="admin-media-error">{{ mediaError }}</p>

        <div class="admin-media-grid">
          <div class="admin-media-slot">
            <label>Foto principal <span class="admin-form-required">*</span></label>
            <div class="admin-media-preview" @click="primaryInput?.click()">
              <img v-if="primaryPreview || form.primaryImageUrl" :src="primaryPreview || form.primaryImageUrl" alt="">
              <span v-else>JPG / PNG / WEBP</span>
            </div>
            <input ref="primaryInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onImageSelect('primary', $event)">
            <button v-if="primaryPreview || form.primaryImageUrl" type="button" class="admin-media-clear" @click="clearImageSlot('primary')">Quitar</button>
          </div>

          <div class="admin-media-slot">
            <label>Foto secundaria <span class="admin-form-required">*</span></label>
            <div class="admin-media-preview" @click="secondaryInput?.click()">
              <img v-if="secondaryPreview || form.secondaryImageUrl" :src="secondaryPreview || form.secondaryImageUrl" alt="">
              <span v-else>JPG / PNG / WEBP</span>
            </div>
            <input ref="secondaryInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onImageSelect('secondary', $event)">
            <button v-if="secondaryPreview || form.secondaryImageUrl" type="button" class="admin-media-clear" @click="clearImageSlot('secondary')">Quitar</button>
          </div>

          <div class="admin-media-slot admin-media-slot--video">
            <label>Video del reloj <span v-if="!imagesOnlyMode && !isEdit" class="admin-form-required">*</span></label>
            <p class="admin-form-hint admin-form-hint--media">
              Máx. {{ MAX_VIDEO_DURATION_SEC }} s · MP4, MOV o WEBM · Se optimiza a 1080p (~10 MB)
              <template v-if="imagesOnlyMode || isEdit"> · Opcional en borrador</template>
            </p>
            <div class="admin-media-preview admin-media-preview--video" @click="videoInput?.click()">
              <video v-if="videoPreview || form.videoUrl" :src="videoPreview || form.videoUrl" controls muted />
              <span v-else>MP4 / MOV / WEBM</span>
            </div>
            <input ref="videoInput" type="file" accept="video/mp4,video/webm,video/quicktime,.mov,.mp4,.webm" class="hidden" @change="onVideoSelect">
            <button v-if="videoPreview || form.videoUrl" type="button" class="admin-media-clear" @click="clearVideoSlot">Quitar</button>
          </div>
        </div>

      </div>
    </div>

    <div class="admin-watch-form-footer">
      <UiLuxButton variant="ghost" type="button" :disabled="isBusy" @click="emit('cancel')">Cancelar</UiLuxButton>
      <UiLuxButton type="submit" :disabled="isBusy">
        {{ saving
          ? 'Guardando...'
          : (imagesOnlyMode && !isEdit ? 'Guardar borrador con imágenes' : (isEdit ? 'Guardar cambios' : 'Crear reloj')) }}
      </UiLuxButton>
    </div>
  </form>
</template>

<style scoped>
.admin-watch-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 90vh;
}

.admin-watch-form-header {
  padding: 24px 28px 16px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.1);
}

.admin-watch-form-title {
  font-family: var(--lux-font-display);
  font-size: 24px;
  font-weight: 300;
  color: var(--lux-white);
  margin-bottom: 4px;
}

.admin-watch-form-subtitle {
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white-dim);
  letter-spacing: 0.05em;
}

.admin-form-error-banner {
  margin: 0 28px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 85, 85, 0.45);
  background: rgba(255, 85, 85, 0.08);
  color: #ff8888;
  font-family: var(--lux-font-body);
  font-size: 12px;
  line-height: 1.5;
}

.admin-watch-tabs {
  display: flex;
  gap: 0;
  padding: 0 28px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.1);
}

.admin-watch-tab {
  padding: 14px 18px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--lux-font-body);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.admin-watch-tab:hover {
  color: var(--lux-white);
}

.admin-watch-tab.active {
  color: var(--lux-gold);
  border-bottom-color: var(--lux-gold);
}

.admin-watch-form-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

.admin-images-only-banner {
  margin-bottom: 20px;
  padding: 14px 16px;
  border: 1px solid rgba(200, 169, 110, 0.18);
  background: rgba(200, 169, 110, 0.04);
}

.admin-watch-tab-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.admin-form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-form-field--full {
  grid-column: 1 / -1;
}

.admin-form-field--inline {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.admin-form-field label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-form-required {
  color: var(--lux-gold);
}

.admin-form-field select,
.admin-form-field textarea,
.admin-form-readonly {
  width: 100%;
  background: transparent;
  border: var(--border-hairline);
  padding: 12px 14px;
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white);
  outline: none;
}

.admin-form-field select:focus,
.admin-form-field textarea:focus {
  border-color: rgba(200, 169, 110, 0.22);
}

.admin-form-field textarea {
  resize: vertical;
  min-height: 100px;
}

.admin-form-readonly {
  background: rgba(255, 255, 255, 0.03);
  color: var(--lux-white-dim);
  cursor: not-allowed;
}

.admin-form-hint {
  margin: 0;
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white-dim);
}

.admin-form-hint--media {
  margin-bottom: 8px;
  line-height: 1.5;
}

.admin-form-field select option {
  background: var(--lux-black-2);
  color: var(--lux-white);
}

.admin-tag-input {
  display: flex;
  gap: 10px;
}

.admin-tag-add {
  padding: 0 18px;
  border: 1px solid var(--lux-gold);
  background: transparent;
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-gold);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.admin-tag-add:hover {
  background: var(--lux-gold);
  color: var(--lux-black);
}

.admin-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.admin-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white);
}

.admin-tag button {
  background: transparent;
  border: none;
  color: var(--lux-white-dim);
  font-size: 14px;
  cursor: pointer;
}

.admin-dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  border: 2px dashed rgba(200, 169, 110, 0.25);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.admin-dropzone:hover {
  border-color: var(--lux-gold);
  background: rgba(200, 169, 110, 0.03);
}

.admin-dropzone-content {
  text-align: center;
  color: var(--lux-white-dim);
}

.admin-dropzone-content svg {
  margin: 0 auto 12px;
  color: var(--lux-gold);
}

.admin-dropzone-content p {
  font-family: var(--lux-font-body);
  font-size: 13px;
  color: var(--lux-white);
  margin-bottom: 6px;
}

.admin-dropzone-content span {
  font-size: 11px;
}

.admin-media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.admin-media-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-media-slot label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-media-preview {
  aspect-ratio: 2 / 3;
  border: 1px dashed rgba(200, 169, 110, 0.25);
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.admin-media-preview img,
.admin-media-preview video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.admin-media-preview span {
  font-family: var(--lux-font-body);
  font-size: 11px;
  color: var(--lux-white-dim);
  text-align: center;
  padding: 12px;
}

.admin-media-clear {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: #ff8888;
  font-size: 11px;
  cursor: pointer;
}

.admin-media-error {
  margin: 0 0 16px;
  color: #ff8888;
  font-size: 12px;
}

.admin-upload-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  font-family: var(--lux-font-body);
  font-size: 12px;
  color: var(--lux-white-dim);
}

.admin-spinner {
  width: 16px;
  height: 16px;
  border: var(--border-hairline);
  border-top-color: var(--lux-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.admin-image-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.admin-image-item {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: var(--lux-black-3);
  overflow: hidden;
}

.admin-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
}

.admin-image-item:hover .admin-image-overlay {
  opacity: 1;
}

.admin-image-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--lux-font-body);
  font-size: 10px;
  color: var(--lux-white);
  cursor: pointer;
}

.admin-image-radio input:checked + span {
  color: var(--lux-gold);
  font-weight: 600;
}

.admin-image-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.admin-image-actions button,
.admin-image-delete {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border-hairline);
  background: rgba(0, 0, 0, 0.5);
  color: var(--lux-white);
  font-size: 14px;
  cursor: pointer;
}

.admin-image-actions button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.admin-image-delete {
  border-color: rgba(255, 85, 85, 0.4);
  color: #ff8888;
}

.admin-image-pending-label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-gold);
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
}

.admin-watch-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 28px;
  border-top: 1px solid rgba(200, 169, 110, 0.1);
}

@media (max-width: 640px) {
  .admin-form-grid,
  .admin-media-grid {
    grid-template-columns: 1fr;
  }

  .admin-watch-tabs {
    overflow-x: auto;
  }
}
</style>
