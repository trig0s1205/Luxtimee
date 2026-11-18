<script setup lang="ts">
import { extractApiErrorMessage } from '~/utils/api-error';

type LabelWatch = {
  id: string;
  sku: string;
  brandName: string;
  model: string;
  stock: number;
  retailPrice: number;
  imageUrl: string | null;
};

const props = defineProps<{ watchIds: string[] }>();
const emit = defineEmits<{ close: [] }>();

const api = useApi();
const toast = useToast();
const { resolve: resolveMedia } = useMediaUrl();

const loading = ref(true);
const generating = ref(false);
const watches = ref<Array<LabelWatch & { quantity: number }>>([]);
const layout = ref<'SHEET_LETTER_3X10' | 'THERMAL_50X25'>('SHEET_LETTER_3X10');
const includePrice = ref(false);
const startPosition = ref(1);
const offsetXmm = ref(0);
const offsetYmm = ref(0);

const OFFSET_KEY = 'luxtimee.labels.offset';

onMounted(async () => {
  try {
    const saved = localStorage.getItem(OFFSET_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { x?: number; y?: number };
      if (typeof parsed.x === 'number') offsetXmm.value = parsed.x;
      if (typeof parsed.y === 'number') offsetYmm.value = parsed.y;
    }
  } catch {
    /* ignore */
  }
  try {
    const rows = await api.post<LabelWatch[]>('/labels/watches/lookup', {
      watchIds: props.watchIds,
    });
    watches.value = rows.map((w) => ({
      ...w,
      quantity: w.stock > 0 ? w.stock : 0,
    }));
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudieron cargar los relojes.'));
    emit('close');
  } finally {
    loading.value = false;
  }
});

const totalLabels = computed(() =>
  watches.value.reduce((sum, w) => sum + Math.max(0, Math.floor(w.quantity || 0)), 0),
);
const sheetCount = computed(() => {
  if (layout.value !== 'SHEET_LETTER_3X10') return 0;
  if (totalLabels.value <= 0) return 0;
  const firstPageSlots = 31 - startPosition.value;
  if (totalLabels.value <= firstPageSlots) return 1;
  return 1 + Math.ceil((totalLabels.value - firstPageSlots) / 30);
});

function setAllToStock() {
  for (const w of watches.value) w.quantity = w.stock > 0 ? w.stock : 0;
}
function setAllToOne() {
  for (const w of watches.value) w.quantity = 1;
}

watch([offsetXmm, offsetYmm], () => {
  localStorage.setItem(
    OFFSET_KEY,
    JSON.stringify({ x: offsetXmm.value, y: offsetYmm.value }),
  );
});

async function generate() {
  if (totalLabels.value <= 0) {
    toast.warning('Indica al menos una etiqueta');
    return;
  }
  generating.value = true;
  try {
    const blob = await api.postBlob('/labels/watches/pdf', {
      items: watches.value.map((w) => ({ watchId: w.id, quantity: w.quantity })),
      layout: layout.value,
      includePrice: includePrice.value,
      startPosition: layout.value === 'SHEET_LETTER_3X10' ? startPosition.value : undefined,
      offsetXmm: offsetXmm.value,
      offsetYmm: offsetYmm.value,
    });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Etiquetas.pdf';
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo generar el PDF.'));
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <div class="admin-labels-overlay" role="dialog" aria-modal="true" @click.self="emit('close')">
    <div class="admin-labels-modal">
      <header class="admin-labels-header">
        <h2>Imprimir etiquetas</h2>
        <button type="button" class="admin-record-btn admin-record-btn--ghost" @click="emit('close')">Cerrar</button>
      </header>

      <p v-if="loading" class="admin-record-muted">Cargando relojes…</p>
      <template v-else>
        <div class="admin-labels-toolbar">
          <button type="button" class="admin-record-btn" @click="setAllToStock">Todo al stock</button>
          <button type="button" class="admin-record-btn" @click="setAllToOne">Todo en 1</button>
        </div>

        <ul class="admin-labels-list">
          <li v-for="watch in watches" :key="watch.id">
            <img
              v-if="watch.imageUrl"
              :src="resolveMedia(watch.imageUrl)"
              :alt="watch.model"
              width="48"
              height="48"
            >
            <div class="admin-labels-meta">
              <strong>{{ watch.brandName }} {{ watch.model }}</strong>
              <span class="admin-record-muted">{{ watch.sku }} · Stock: {{ watch.stock }}</span>
              <span v-if="watch.stock === 0" class="admin-record-muted">Sin stock: escribe cuántas necesitas</span>
            </div>
            <label>
              Cantidad
              <input v-model.number="watch.quantity" type="number" min="0" max="500" class="admin-labels-qty">
            </label>
          </li>
        </ul>

        <fieldset class="admin-labels-fieldset">
          <legend>Formato</legend>
          <label>
            <input v-model="layout" type="radio" value="SHEET_LETTER_3X10">
            Hoja Carta · 30 por hoja (Avery 5160 / 66,7 × 25,4 mm)
          </label>
          <label>
            <input v-model="layout" type="radio" value="THERMAL_50X25">
            Impresora térmica · 50 × 25 mm
          </label>
        </fieldset>

        <label class="admin-labels-switch">
          <input v-model="includePrice" type="checkbox">
          Incluir precio
        </label>

        <div v-if="layout === 'SHEET_LETTER_3X10'" class="admin-labels-start">
          <label>
            Empezar en la posición
            <input v-model.number="startPosition" type="number" min="1" max="30">
          </label>
          <div class="admin-labels-grid" aria-hidden="true">
            <button
              v-for="n in 30"
              :key="n"
              type="button"
              class="admin-labels-cell"
              :class="{ 'admin-labels-cell--used': n < startPosition, 'admin-labels-cell--active': n === startPosition }"
              @click="startPosition = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <details class="admin-labels-offsets">
          <summary>Ajuste fino de impresión</summary>
          <label>
            Desplazamiento X (mm)
            <input v-model.number="offsetXmm" type="number" min="-5" max="5" step="0.5">
          </label>
          <label>
            Desplazamiento Y (mm)
            <input v-model.number="offsetYmm" type="number" min="-5" max="5" step="0.5">
          </label>
        </details>

        <p class="admin-labels-summary">
          <template v-if="layout === 'SHEET_LETTER_3X10'">
            Total: {{ totalLabels }} etiquetas · {{ sheetCount }} hojas
          </template>
          <template v-else>
            Total: {{ totalLabels }} etiquetas térmicas
          </template>
        </p>

        <p class="admin-config-hint">
          Imprime a escala 100 % / Tamaño real (desactiva 'Ajustar a la página'). Prueba primero en una hoja normal y ponla sobre la hoja de etiquetas a contraluz.
        </p>

        <button
          type="button"
          class="admin-record-btn admin-record-btn--primary"
          :disabled="generating || totalLabels <= 0"
          @click="generate"
        >
          {{ generating ? 'Generando…' : 'Generar PDF' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.admin-labels-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 16px;
}
.admin-labels-modal {
  width: min(720px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--lux-black, #111);
  border: var(--border-hairline, 1px solid #333);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.admin-labels-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.admin-labels-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.admin-labels-list li {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 10px;
  align-items: center;
}
.admin-labels-list img {
  object-fit: contain;
  background: #fff;
}
.admin-labels-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-labels-qty {
  width: 72px;
}
.admin-labels-fieldset {
  border: var(--border-hairline, 1px solid #333);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.admin-labels-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  max-width: 180px;
}
.admin-labels-cell {
  min-height: 28px;
  font-size: 11px;
  background: transparent;
  border: 1px solid #444;
  color: inherit;
}
.admin-labels-cell--used {
  background: #333;
  color: #888;
}
.admin-labels-cell--active {
  border-color: var(--lux-gold, #b8962e);
}
.admin-labels-summary {
  font-weight: 600;
}
</style>
