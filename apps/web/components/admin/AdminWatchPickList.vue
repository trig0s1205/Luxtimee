<script setup lang="ts">
import type { WatchStaffDto } from '@luxtime/shared';
import { watchPrimaryImage } from '~/utils/media-url';

defineProps<{
  watches: WatchStaffDto[];
  total?: number;
}>();

const emit = defineEmits<{ select: [watch: WatchStaffDto] }>();

const lightboxSrc = ref<string | null>(null);

function preview(watch: WatchStaffDto) {
  const src = watchPrimaryImage(watch);
  if (src) lightboxSrc.value = src;
}
</script>

<template>
  <div v-if="watches.length" class="admin-watch-picks">
    <ul class="admin-watch-picks__list">
      <li v-for="watch in watches" :key="watch.id" class="admin-watch-pick">
        <button
          type="button"
          class="admin-watch-pick__thumb"
          :disabled="!watchPrimaryImage(watch)"
          :title="watchPrimaryImage(watch) ? 'Ver imagen' : 'Sin foto'"
          @click="preview(watch)"
        >
          <img
            v-if="watchPrimaryImage(watch)"
            :src="watchPrimaryImage(watch)"
            :alt="`${watch.brand.name} ${watch.model}`"
          >
          <span v-else>Sin foto</span>
        </button>
        <button type="button" class="admin-watch-pick__main" @click="emit('select', watch)">
          <strong>{{ watch.sku }}</strong>
          <span>{{ watch.brand.name }} {{ watch.model }}</span>
          <small v-if="$slots.meta"><slot name="meta" :watch="watch" /></small>
        </button>
      </li>
    </ul>
    <p v-if="total != null && total > watches.length" class="admin-watch-picks__more">
      Hay {{ total }} relojes. Se muestran {{ watches.length }}. Escribe más para acotar.
    </p>
    <AdminImageLightbox :src="lightboxSrc" @close="lightboxSrc = null" />
  </div>
</template>

<style scoped>
.admin-watch-picks__list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.admin-watch-pick {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-top: 1px solid rgba(200, 169, 110, 0.12);
}

.admin-watch-pick:first-child {
  border-top: 0;
}

.admin-watch-pick__thumb,
.admin-watch-pick__main {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.admin-watch-pick__thumb {
  flex: 0 0 56px;
  width: 56px;
  min-height: 56px;
  padding: 6px;
  cursor: zoom-in;
}

.admin-watch-pick__thumb:disabled {
  cursor: default;
}

.admin-watch-pick__thumb img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(200, 169, 110, 0.2);
}

.admin-watch-pick__thumb span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 9px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  border: 1px solid rgba(200, 169, 110, 0.15);
}

.admin-watch-pick__main {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-watch-pick__main:hover {
  background: rgba(200, 169, 110, 0.06);
}

.admin-watch-pick__main strong {
  font-size: 12px;
  letter-spacing: 0.04em;
}

.admin-watch-pick__main span,
.admin-watch-pick__main small {
  font-size: 13px;
  color: var(--lux-white-dim);
}

.admin-watch-picks__more {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--lux-white-dim);
}
</style>
