<script setup lang="ts">
const props = defineProps<{
  frontUrl?: string | null;
  backUrl?: string | null;
  videoUrl?: string | null;
  alt: string;
}>();

type MediaView = 'front' | 'back' | 'video';

const active = ref<MediaView>('front');

const hasBack = computed(() => !!props.backUrl);
const hasVideo = computed(() => !!props.videoUrl);
const showTabs = computed(() => hasBack.value || hasVideo.value);
</script>

<template>
  <div class="space-y-4">
    <div class="aspect-[2/3] bg-lux-black-2 flex items-center justify-center overflow-hidden">
      <video
        v-if="active === 'video' && videoUrl"
        :src="videoUrl"
        class="w-full h-full object-contain"
        controls
        playsinline
      />
      <img
        v-else
        :src="(active === 'back' && backUrl ? backUrl : frontUrl) || undefined"
        :alt="alt"
        class="w-full h-full object-contain"
      >
    </div>
    <div v-if="showTabs" class="gallery-tabs">
      <button
        type="button"
        class="gallery-tab"
        :class="{ 'gallery-tab--active': active === 'front' }"
        @click="active = 'front'"
      >
        Frontal
      </button>
      <button
        v-if="hasBack"
        type="button"
        class="gallery-tab"
        :class="{ 'gallery-tab--active': active === 'back' }"
        @click="active = 'back'"
      >
        Trasera
      </button>
      <button
        v-if="hasVideo"
        type="button"
        class="gallery-tab"
        :class="{ 'gallery-tab--active': active === 'video' }"
        @click="active = 'video'"
      >
        Video
      </button>
    </div>
  </div>
</template>

<style scoped>
.gallery-tabs {
  display: flex;
  gap: 8px;
}

.gallery-tab {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  border-bottom: var(--border-hairline);
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--white-dim);
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s;
}

.gallery-tab:hover {
  color: var(--white);
}

.gallery-tab--active {
  color: var(--gold);
  border-bottom-color: rgba(200, 169, 110, 0.25);
}
</style>
