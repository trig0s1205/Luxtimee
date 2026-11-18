<script setup lang="ts">
import type { DuplicateHitView } from '~/utils/image-duplicates';

defineProps<{
  hits: DuplicateHitView[];
  showSkipAll?: boolean;
}>();

const emit = defineEmits<{
  skip: [];
  keep: [];
  skipAll: [];
}>();
</script>

<template>
  <div class="dup-warn" data-testid="image-duplicate-warning" role="status">
    <p>
      Esta foto ya está en el inventario o se repite en este lote.
      No se bloquea la carga: omítela o súbela igual.
    </p>
    <ul>
      <li v-for="hit in hits" :key="hit.key">
        <img v-if="hit.thumb" :src="hit.thumb" alt="">
        <div>
          <a v-if="hit.href" :href="hit.href">{{ hit.title }}</a>
          <strong v-else>{{ hit.title }}</strong>
          <span>{{ hit.detail }}</span>
        </div>
      </li>
    </ul>
    <div class="dup-warn-actions">
      <button type="button" class="admin-pagination-btn" @click="emit('skip')">Omitir</button>
      <button type="button" class="admin-pagination-btn" @click="emit('keep')">Subir de todas formas</button>
      <button v-if="showSkipAll" type="button" class="admin-pagination-btn" @click="emit('skipAll')">
        Omitir todas las repetidas
      </button>
    </div>
  </div>
</template>

<style scoped>
.dup-warn {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: rgba(200, 169, 110, 0.08);
  color: var(--lux-white, #f5f1e8);
  font-family: var(--lux-font-body, sans-serif);
  font-size: 12px;
  line-height: 1.4;
}

.dup-warn p {
  margin: 0 0 8px;
}

.dup-warn ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dup-warn li {
  display: flex;
  gap: 10px;
  align-items: center;
}

.dup-warn img {
  width: 54px;
  height: 72px;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.35);
}

.dup-warn a,
.dup-warn strong {
  display: block;
  color: var(--lux-gold, #c8a96e);
  font-weight: 500;
}

.dup-warn span {
  color: var(--lux-white-dim, rgba(255, 255, 255, 0.72));
}

.dup-warn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
