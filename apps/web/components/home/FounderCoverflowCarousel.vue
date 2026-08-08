<script setup lang="ts">
const props = defineProps<{
  images: string[];
}>();

const { resolve } = useMediaUrl();

const INTERVAL_MS = 4200;
const active = ref(0);
const paused = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const slides = computed(() =>
  props.images
    .map((u) => resolve(u))
    .filter(Boolean)
    .slice(0, 5) as string[],
);
const ready = computed(() => slides.value.length === 5);

function relativeOffset(index: number) {
  const n = slides.value.length;
  if (!n) return 0;
  let diff = index - active.value;
  if (diff > n / 2) diff -= n;
  if (diff < -n / 2) diff += n;
  return diff;
}

function slideStyle(index: number) {
  const offset = relativeOffset(index);
  const abs = Math.abs(offset);
  const rotateY = offset * -42;
  const translateX = offset * 58;
  const translateZ = abs === 0 ? 80 : 40 - abs * 55;
  const scale = abs === 0 ? 1 : Math.max(0.62, 1 - abs * 0.14);
  const opacity = abs > 2 ? 0 : abs === 0 ? 1 : Math.max(0.35, 1 - abs * 0.28);
  return {
    transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
    zIndex: 20 - abs,
    opacity,
  };
}

function next() {
  if (!ready.value) return;
  active.value = (active.value + 1) % slides.value.length;
}

function prev() {
  if (!ready.value) return;
  active.value = (active.value - 1 + slides.value.length) % slides.value.length;
}

function goTo(i: number) {
  active.value = i;
}

function start() {
  stop();
  if (!import.meta.client || !ready.value) return;
  timer = setInterval(() => {
    if (!paused.value) next();
  }, INTERVAL_MS);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(ready, (ok) => {
  if (ok) {
    active.value = 0;
    start();
  } else {
    stop();
  }
}, { immediate: true });

onUnmounted(stop);
</script>

<template>
  <div
    v-if="ready"
    class="lux-coverflow"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="lux-coverflow__stage">
      <button
        v-for="(src, i) in slides"
        :key="`${src}-${i}`"
        type="button"
        class="lux-coverflow__card"
        :class="{ 'lux-coverflow__card--active': relativeOffset(i) === 0 }"
        :style="slideStyle(i)"
        :aria-label="`Foto ${i + 1}`"
        :aria-current="relativeOffset(i) === 0 ? 'true' : undefined"
        @click="goTo(i)"
      >
        <img :src="src" :alt="`LUXTIMEE ${i + 1}`" loading="lazy" draggable="false" />
        <span v-if="i === 0 && relativeOffset(i) === 0" class="lux-coverflow__badge">Principal</span>
      </button>
    </div>

    <div class="lux-coverflow__controls">
      <button type="button" class="lux-coverflow__nav" aria-label="Anterior" @click="prev">‹</button>
      <div class="lux-coverflow__dots">
        <button
          v-for="(_, i) in slides"
          :key="i"
          type="button"
          class="lux-coverflow__dot"
          :class="{ 'lux-coverflow__dot--on': i === active }"
          :aria-label="`Ir a foto ${i + 1}`"
          @click="goTo(i)"
        />
      </div>
      <button type="button" class="lux-coverflow__nav" aria-label="Siguiente" @click="next">›</button>
    </div>
  </div>
</template>

<style scoped>
.lux-coverflow {
  width: 100%;
  user-select: none;
}

.lux-coverflow__stage {
  position: relative;
  height: clamp(320px, 42vw, 480px);
  perspective: 1100px;
  transform-style: preserve-3d;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lux-coverflow__card {
  position: absolute;
  width: min(58%, 300px);
  aspect-ratio: 3 / 4;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  transform-style: preserve-3d;
  transition: transform 0.85s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.85s ease;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(200, 169, 110, 0.12);
}

.lux-coverflow__card--active {
  border-color: rgba(200, 169, 110, 0.45);
  box-shadow:
    0 0 0 1px rgba(200, 169, 110, 0.25),
    0 32px 70px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(200, 169, 110, 0.12);
}

.lux-coverflow__card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.lux-coverflow__badge {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 4px 10px;
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--black);
  background: linear-gradient(135deg, var(--gold-light), var(--gold));
  border-radius: 999px;
}

.lux-coverflow__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.25rem;
}

.lux-coverflow__nav {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: rgba(255, 255, 255, 0.03);
  color: var(--gold);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.25s, border-color 0.25s;
}

.lux-coverflow__nav:hover {
  background: rgba(200, 169, 110, 0.12);
  border-color: rgba(200, 169, 110, 0.6);
}

.lux-coverflow__dots {
  display: flex;
  gap: 0.4rem;
}

.lux-coverflow__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(200, 169, 110, 0.25);
  cursor: pointer;
  transition: background 0.25s, transform 0.25s;
}

.lux-coverflow__dot--on {
  background: var(--gold);
  transform: scale(1.25);
}

@media (max-width: 640px) {
  .lux-coverflow__stage {
    height: 280px;
  }

  .lux-coverflow__card {
    width: min(68%, 220px);
  }

  .lux-coverflow__nav {
    width: 44px;
    height: 44px;
    font-size: 1.4rem;
  }
}

@media (max-width: 480px) {
  .lux-coverflow__stage {
    height: 250px;
  }

  .lux-coverflow__card {
    width: min(72%, 200px);
  }
}
</style>
