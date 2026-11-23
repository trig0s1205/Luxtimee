<script setup lang="ts">
import type { DuplicateHitView } from '~/utils/image-duplicates';

const props = defineProps<{
  incoming?: string;
  hits: DuplicateHitView[];
  showSkipAll?: boolean;
}>();

const emit = defineEmits<{
  skip: [];
  keep: [];
  skipAll: [];
  zoom: [src: string];
}>();

const match = computed(() => props.hits[0] ?? null);

function label(kind: DuplicateHitView['kind']) {
  return kind === 'exact' ? 'Ya existe' : 'Muy parecida';
}
</script>

<template>
  <div class="dup-warn" data-testid="image-duplicate-warning" role="status">
    <div v-if="match" class="dup-pair">
      <button v-if="incoming" type="button" class="dup-shot" @click="emit('zoom', incoming)">
        <img :src="incoming" alt="Foto nueva">
        <span>Nueva</span>
      </button>
      <button v-if="match.thumb" type="button" class="dup-shot" @click="emit('zoom', match.thumb)">
        <img :src="match.thumb" alt="Foto existente">
        <span>Inventario</span>
      </button>
      <div class="dup-copy">
        <strong>{{ label(match.kind) }}</strong>
        <em v-if="match.caption">{{ match.caption }}</em>
      </div>
    </div>
    <div class="dup-warn-actions">
      <button type="button" class="admin-pagination-btn" @click="emit('skip')">Quitar de esta carga</button>
      <button type="button" class="admin-pagination-btn" @click="emit('keep')">Subir igual</button>
      <button v-if="showSkipAll" type="button" class="admin-pagination-btn" @click="emit('skipAll')">
        Quitar todas las repetidas
      </button>
    </div>
  </div>
</template>

<style scoped>
.dup-warn {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: rgba(255, 255, 255, 0.03);
  color: var(--lux-white, #f5f1e8);
  font-family: var(--lux-font-body, sans-serif);
}

.dup-pair {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.dup-shot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lux-white-dim, rgba(255, 255, 255, 0.62));
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.dup-shot img {
  width: 92px;
  height: 118px;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.35);
}

.dup-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dup-copy strong {
  font-family: var(--lux-font-display, serif);
  font-size: 18px;
  font-weight: 400;
  color: var(--lux-gold, #c8a96e);
}

.dup-copy em {
  font-style: normal;
  font-size: 12px;
  color: var(--lux-white-dim, rgba(255, 255, 255, 0.55));
}

.dup-warn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
