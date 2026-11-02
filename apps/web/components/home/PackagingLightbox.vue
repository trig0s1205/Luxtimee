<script setup lang="ts">
import type { PackagingPhotoDto } from '@luxtime/shared';
import { packagingImageSrc } from '~/utils/packaging-gallery';

const props = defineProps<{
  photos: PackagingPhotoDto[];
  startIndex?: number;
}>();

const emit = defineEmits<{ close: [] }>();

const { resolve } = useMediaUrl();
const index = ref(0);
const closeBtn = ref<HTMLButtonElement | null>(null);
let previousOverflow = '';

const current = computed(() => props.photos[index.value] ?? null);
const largeSrc = computed(() => {
  const url = current.value?.imageUrl;
  if (!url) return '';
  const absolute = resolve(url) ?? url;
  return packagingImageSrc(absolute, 1600);
});
const caption = computed(() => current.value?.caption?.trim() || '');

function clamp(value: number) {
  const max = props.photos.length - 1;
  if (max < 0) return 0;
  return Math.min(Math.max(value, 0), max);
}

function step(direction: -1 | 1) {
  if (props.photos.length < 2) return;
  index.value = (index.value + direction + props.photos.length) % props.photos.length;
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    step(1);
  }
}

onMounted(() => {
  index.value = clamp(props.startIndex ?? 0);
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKey);
  nextTick(() => closeBtn.value?.focus());
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow;
  window.removeEventListener('keydown', onKey);
});

watch(() => props.photos.length, () => {
  index.value = clamp(index.value);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="lux-pack-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Fotos de empaque"
      @click="emit('close')"
    >
      <button
        ref="closeBtn"
        type="button"
        class="lux-pack-lightbox__close"
        aria-label="Cerrar"
        @click.stop="emit('close')"
      >
        ×
      </button>
      <button
        v-if="photos.length > 1"
        type="button"
        class="lux-pack-lightbox__nav lux-pack-lightbox__nav--prev"
        aria-label="Foto anterior"
        @click.stop="step(-1)"
      >
        ‹
      </button>
      <figure v-if="current" class="lux-pack-lightbox__figure" @click.stop>
        <img
          :src="largeSrc"
          :alt="caption || 'Empaque del reloj LUXTIMEE'"
          draggable="false"
          decoding="async"
        >
        <figcaption v-if="caption">{{ caption }}</figcaption>
        <p v-if="photos.length > 1" class="lux-pack-lightbox__count">
          {{ index + 1 }} / {{ photos.length }}
        </p>
      </figure>
      <button
        v-if="photos.length > 1"
        type="button"
        class="lux-pack-lightbox__nav lux-pack-lightbox__nav--next"
        aria-label="Foto siguiente"
        @click.stop="step(1)"
      >
        ›
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.lux-pack-lightbox {
  position: fixed;
  inset: 0;
  z-index: 110000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4.5rem 1.25rem 2rem;
  background: rgba(0, 0, 0, 0.92);
}

.lux-pack-lightbox__figure {
  margin: 0;
  max-width: min(920px, 100%);
  text-align: center;
}

.lux-pack-lightbox__figure img {
  display: block;
  max-width: min(920px, 100%);
  max-height: min(78vh, 900px);
  margin: 0 auto;
  object-fit: contain;
  border: 1px solid rgba(200, 169, 110, 0.28);
  background: #111;
}

.lux-pack-lightbox__figure figcaption,
.lux-pack-lightbox__count {
  margin: 0.75rem 0 0;
  color: rgba(255, 255, 255, 0.86);
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.lux-pack-lightbox__count {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  letter-spacing: 0.16em;
}

.lux-pack-lightbox__close,
.lux-pack-lightbox__nav {
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
}

.lux-pack-lightbox__close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  width: 40px;
  height: 40px;
  font-size: 24px;
}

.lux-pack-lightbox__nav {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  font-size: 26px;
  line-height: 1;
}

@media (max-width: 640px) {
  .lux-pack-lightbox {
    padding-inline: 0.75rem;
  }

  .lux-pack-lightbox__nav {
    position: absolute;
    bottom: 1.25rem;
  }

  .lux-pack-lightbox__nav--prev { left: 1rem; }
  .lux-pack-lightbox__nav--next { right: 1rem; }
}
</style>
