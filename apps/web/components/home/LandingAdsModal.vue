<script setup lang="ts">
import type { LandingAd } from '@luxtime/shared';

const props = defineProps<{
  ads: [LandingAd, LandingAd, LandingAd];
}>();

const STORAGE_KEY = 'luxtimee-landing-ads-v1';

const visible = ref(false);
const currentIndex = ref(0);

const activeAds = computed(() => props.ads.filter((ad) => ad.enabled && (ad.title || ad.imageUrl)));
const ad = computed<LandingAd | null>(() => activeAds.value[currentIndex.value] ?? null);

function close() {
  visible.value = false;
}

function next() {
  if (currentIndex.value < activeAds.value.length - 1) {
    currentIndex.value++;
  } else {
    close();
  }
}

let alive = true;

function maybeOpen() {
  if (!import.meta.client || !alive) return;
  if (sessionStorage.getItem(STORAGE_KEY) || activeAds.value.length === 0 || visible.value) return;
  visible.value = true;
  queueMicrotask(() => {
    if (alive && visible.value) sessionStorage.setItem(STORAGE_KEY, '1');
  });
}

onMounted(maybeOpen);
watch(activeAds, maybeOpen);
onUnmounted(() => {
  alive = false;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="landing-ads-fade">
      <div v-if="visible && ad" class="landing-ads-overlay" @click.self="close">
        <div
          class="landing-ads-modal"
          :class="`landing-ads-modal--${ad.type}`"
        >
          <!-- Close -->
          <button class="landing-ads-close" type="button" aria-label="Cerrar" @click="close">✕</button>

          <template v-if="ad.type === 'spotlight'">
            <div v-if="ad.imageUrl" class="landing-ads-frame landing-ads-frame--spotlight">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-copy">
              <p v-if="ad.eyebrow" class="landing-ads-eyebrow">{{ ad.eyebrow }}</p>
              <h2 class="landing-ads-title">{{ ad.title }}</h2>
              <p v-if="ad.body" class="landing-ads-body">{{ ad.body }}</p>
              <div class="landing-ads-actions">
                <NuxtLink v-if="ad.ctaLink" :to="ad.ctaLink" class="landing-ads-cta" @click="close">
                  {{ ad.ctaText || 'Ver más' }}
                </NuxtLink>
                <button v-if="activeAds.length > 1" type="button" class="landing-ads-skip" @click="next">
                  {{ currentIndex < activeAds.length - 1 ? 'Siguiente →' : 'Cerrar' }}
                </button>
              </div>
            </div>
          </template>

          <template v-else-if="ad.type === 'editorial'">
            <div v-if="ad.imageUrl" class="landing-ads-frame landing-ads-frame--editorial">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-copy landing-ads-copy--center">
              <p v-if="ad.eyebrow" class="landing-ads-eyebrow">{{ ad.eyebrow }}</p>
              <h2 class="landing-ads-title">{{ ad.title }}</h2>
              <p v-if="ad.body" class="landing-ads-body">{{ ad.body }}</p>
              <div class="landing-ads-actions">
                <NuxtLink v-if="ad.ctaLink" :to="ad.ctaLink" class="landing-ads-cta" @click="close">
                  {{ ad.ctaText || 'Ver más' }}
                </NuxtLink>
                <button v-if="activeAds.length > 1" type="button" class="landing-ads-skip" @click="next">
                  {{ currentIndex < activeAds.length - 1 ? 'Siguiente →' : 'Cerrar' }}
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-if="ad.imageUrl" class="landing-ads-frame landing-ads-frame--story">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-copy landing-ads-copy--center">
              <p v-if="ad.eyebrow" class="landing-ads-eyebrow">{{ ad.eyebrow }}</p>
              <h2 class="landing-ads-title">{{ ad.title }}</h2>
              <p v-if="ad.body" class="landing-ads-body">{{ ad.body }}</p>
              <div class="landing-ads-actions">
                <NuxtLink v-if="ad.ctaLink" :to="ad.ctaLink" class="landing-ads-cta" @click="close">
                  {{ ad.ctaText || 'Ver más' }}
                </NuxtLink>
                <button v-if="activeAds.length > 1" type="button" class="landing-ads-skip" @click="next">
                  {{ currentIndex < activeAds.length - 1 ? 'Siguiente →' : 'Cerrar' }}
                </button>
              </div>
            </div>
          </template>

          <!-- Pagination dots -->
          <div v-if="activeAds.length > 1" class="landing-ads-dots">
            <span
              v-for="(_, i) in activeAds"
              :key="i"
              class="landing-ads-dot"
              :class="{ 'landing-ads-dot--active': i === currentIndex }"
              @click="currentIndex = i"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.landing-ads-overlay {
  position: fixed;
  inset: 0;
  z-index: 100001;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.landing-ads-modal {
  position: relative;
  background: #0b0b0b;
  border: 1px solid rgba(201, 168, 76, 0.45);
  border-radius: 18px;
  overflow: auto;
  max-width: 920px;
  width: min(920px, 100%);
  max-height: min(92dvh, 860px);
  box-shadow:
    0 0 0 1px rgba(201, 168, 76, 0.12),
    0 28px 80px rgba(0, 0, 0, 0.72),
    0 0 48px rgba(201, 168, 76, 0.16);
}

.landing-ads-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.62);
  border: 1px solid rgba(201, 168, 76, 0.45);
  color: #fff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-ads-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background:
    radial-gradient(ellipse at center, #242424 0%, #0a0a0a 72%);
  min-width: 0;
}

.landing-ads-frame img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
}

.landing-ads-copy {
  padding: 28px 28px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.landing-ads-copy--center {
  text-align: center;
}

.landing-ads-copy--center .landing-ads-actions {
  justify-content: center;
}

.landing-ads-eyebrow {
  display: inline-flex;
  align-self: flex-start;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #e6c36a;
  margin: 0 0 10px;
  padding: 4px 10px;
  border: 1px solid rgba(201, 168, 76, 0.45);
  border-radius: 999px;
}

.landing-ads-copy--center .landing-ads-eyebrow {
  align-self: center;
}

.landing-ads-title {
  font-size: clamp(1.45rem, 3.4vw, 2.15rem);
  font-weight: 700;
  line-height: 1.12;
  color: #fff;
  margin: 0 0 10px;
  overflow-wrap: anywhere;
}

.landing-ads-body {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.74);
  line-height: 1.55;
  margin: 0 0 18px;
  overflow-wrap: anywhere;
}

.landing-ads-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.landing-ads-cta {
  display: inline-block;
  padding: 12px 26px;
  background: linear-gradient(180deg, #e8c56b 0%, #c9a84c 100%);
  color: #111;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 8px 22px rgba(201, 168, 76, 0.28);
}

.landing-ads-skip {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
}

.landing-ads-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 0 16px;
}

.landing-ads-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
}

.landing-ads-dot--active {
  background: #e6c36a;
  transform: scale(1.15);
}

.landing-ads-modal--spotlight {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  grid-template-rows: auto auto;
}

.landing-ads-frame--spotlight {
  grid-column: 1;
  grid-row: 1;
  height: min(520px, 70vh);
}

.landing-ads-modal--spotlight .landing-ads-copy {
  grid-column: 2;
  grid-row: 1;
}

.landing-ads-modal--spotlight .landing-ads-dots {
  grid-column: 1 / -1;
}

.landing-ads-modal--editorial {
  display: flex;
  flex-direction: column;
  max-width: 680px;
}

.landing-ads-frame--editorial {
  aspect-ratio: 16 / 9;
  width: 100%;
  max-height: 46vh;
}

.landing-ads-modal--story {
  display: flex;
  flex-direction: column;
  max-width: 460px;
}

.landing-ads-frame--story {
  aspect-ratio: 4 / 5;
  width: 100%;
  max-height: 54vh;
}

.landing-ads-fade-enter-active,
.landing-ads-fade-leave-active {
  transition: opacity 0.3s ease;
}

.landing-ads-fade-enter-from,
.landing-ads-fade-leave-to {
  opacity: 0;
}

@media (max-width: 800px) {
  .landing-ads-overlay {
    padding: 10px;
    align-items: flex-end;
  }

  .landing-ads-modal,
  .landing-ads-modal--editorial,
  .landing-ads-modal--story {
    max-width: 100%;
    max-height: min(94dvh, 860px);
    border-radius: 16px 16px 12px 12px;
  }

  .landing-ads-modal--spotlight {
    grid-template-columns: 1fr;
  }

  .landing-ads-frame--spotlight,
  .landing-ads-modal--spotlight .landing-ads-copy {
    grid-column: 1;
  }

  .landing-ads-frame--spotlight {
    grid-column: 1;
    grid-row: 1;
    height: min(42vh, 280px);
    aspect-ratio: auto;
    max-height: none;
  }

  .landing-ads-modal--spotlight .landing-ads-copy {
    grid-row: 2;
  }

  .landing-ads-frame--editorial {
    aspect-ratio: 16 / 10;
    max-height: 38vh;
  }

  .landing-ads-frame--story {
    aspect-ratio: 4 / 5;
    max-height: 46vh;
  }

  .landing-ads-copy {
    padding: 18px 16px 4px;
  }

  .landing-ads-cta {
    width: 100%;
    text-align: center;
  }

  .landing-ads-actions {
    width: 100%;
  }
}
</style>
