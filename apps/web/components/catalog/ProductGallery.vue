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

function selectView(view: MediaView) {
  active.value = view;
}
</script>

<template>
  <div class="product-gallery">
    <div class="product-gallery__stage">
      <video
        v-if="active === 'video' && videoUrl"
        :src="videoUrl"
        class="product-gallery__media"
        controls
        playsinline
      />
      <img
        v-else
        :src="(active === 'back' && backUrl ? backUrl : frontUrl) || undefined"
        :alt="alt"
        class="product-gallery__media"
      >
    </div>

    <div v-if="showTabs" class="product-gallery__tabs">
      <button
        type="button"
        class="product-gallery__tab"
        :class="{ 'product-gallery__tab--active': active === 'front' }"
        @click="selectView('front')"
      >
        Frontal
      </button>
      <button
        v-if="hasBack"
        type="button"
        class="product-gallery__tab"
        :class="{ 'product-gallery__tab--active': active === 'back' }"
        @click="selectView('back')"
      >
        Trasera
      </button>
      <button
        v-if="hasVideo"
        type="button"
        class="product-gallery__tab"
        :class="{ 'product-gallery__tab--active': active === 'video' }"
        @click="selectView('video')"
      >
        Video
      </button>
    </div>
  </div>
</template>

<style scoped>
.product-gallery {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 358px;
  margin: 0 auto;
}

.product-gallery__stage {
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--black-2);
  border: var(--border-hairline);
}

.product-gallery__media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-gallery__tabs {
  display: flex;
  gap: 8px;
}

.product-gallery__tab {
  flex: 1;
  padding: 12px 10px;
  background: rgba(200, 169, 110, 0.08);
  border: 1px solid rgba(200, 169, 110, 0.22);
  border-radius: 2px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-dim);
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s, background 0.25s;
}

.product-gallery__tab:hover {
  color: var(--white);
  background: rgba(200, 169, 110, 0.12);
  border-color: rgba(200, 169, 110, 0.35);
}

.product-gallery__tab--active {
  color: var(--gold);
  background: rgba(200, 169, 110, 0.18);
  border-color: rgba(200, 169, 110, 0.55);
  box-shadow: 0 0 0 1px rgba(200, 169, 110, 0.15);
}
</style>
