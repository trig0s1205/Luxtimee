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

onMounted(() => {
  // Only show on true entry navigations (not SPA client-side nav from /catalogo → /)
  const isEntry = !sessionStorage.getItem(STORAGE_KEY);
  if (!isEntry || activeAds.value.length === 0) return;
  sessionStorage.setItem(STORAGE_KEY, '1');
  visible.value = true;
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

          <!-- SPOTLIGHT layout: big image left, text right -->
          <template v-if="ad.type === 'spotlight'">
            <div v-if="ad.imageUrl" class="landing-ads-spotlight__image">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-spotlight__content">
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

          <!-- EDITORIAL layout: full-width image top, centered text below -->
          <template v-else-if="ad.type === 'editorial'">
            <div v-if="ad.imageUrl" class="landing-ads-editorial__image">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-editorial__content">
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

          <!-- STORY layout: full-bleed background image, text overlay at bottom -->
          <template v-else>
            <div v-if="ad.imageUrl" class="landing-ads-story__bg">
              <img :src="ad.imageUrl" :alt="ad.title || 'Promoción LUXTIMEE'" />
            </div>
            <div class="landing-ads-story__content">
              <p v-if="ad.eyebrow" class="landing-ads-eyebrow">{{ ad.eyebrow }}</p>
              <h2 class="landing-ads-title">{{ ad.title }}</h2>
              <p v-if="ad.body" class="landing-ads-body">{{ ad.body }}</p>
              <div class="landing-ads-actions">
                <NuxtLink v-if="ad.ctaLink" :to="ad.ctaLink" class="landing-ads-cta" @click="close">
                  {{ ad.ctaText || 'Ver más' }}
                </NuxtLink>
                <button v-if="activeAds.length > 1" type="button" class="landing-ads-skip landing-ads-skip--light" @click="next">
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
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.landing-ads-modal {
  position: relative;
  background: #0c0c0c;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  overflow: hidden;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
}

/* ── CLOSE ── */
.landing-ads-close {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.landing-ads-close:hover { background: rgba(255, 255, 255, 0.15); }

/* ── COMMON TEXT ── */
.landing-ads-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gold, #c9a84c);
  margin: 0 0 6px;
}

.landing-ads-title {
  font-size: clamp(1.25rem, 4vw, 2rem);
  font-weight: 700;
  line-height: 1.15;
  color: #fff;
  margin: 0 0 10px;
}

.landing-ads-body {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin: 0 0 18px;
}

.landing-ads-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.landing-ads-cta {
  display: inline-block;
  padding: 10px 22px;
  background: var(--color-gold, #c9a84c);
  color: #000;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 4px;
  text-decoration: none;
  transition: opacity 0.2s;
}
.landing-ads-cta:hover { opacity: 0.85; }

.landing-ads-skip {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}
.landing-ads-skip:hover { color: #fff; }
.landing-ads-skip--light { color: rgba(0, 0, 0, 0.5); }
.landing-ads-skip--light:hover { color: #000; }

/* ── DOTS ── */
.landing-ads-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 12px 0 8px;
}
.landing-ads-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: background 0.2s;
}
.landing-ads-dot--active { background: var(--color-gold, #c9a84c); }

/* ── SPOTLIGHT ── */
.landing-ads-modal--spotlight .landing-ads-spotlight__image,
.landing-ads-modal--spotlight .landing-ads-spotlight__content {
  display: flex;
}
.landing-ads-modal--spotlight {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
}
.landing-ads-spotlight__image {
  grid-column: 1;
  grid-row: 1;
  max-height: 500px;
  overflow: hidden;
}
.landing-ads-spotlight__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.landing-ads-spotlight__content {
  grid-column: 2;
  grid-row: 1;
  padding: 36px 28px;
  flex-direction: column;
  justify-content: center;
}
.landing-ads-modal--spotlight .landing-ads-dots {
  grid-column: 1 / -1;
}
.landing-ads-modal--spotlight .landing-ads-close {
  top: 12px;
  right: 14px;
}

/* ── EDITORIAL ── */
.landing-ads-modal--editorial {
  display: flex;
  flex-direction: column;
  max-width: 640px;
}
.landing-ads-editorial__image {
  height: 260px;
  overflow: hidden;
}
.landing-ads-editorial__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.landing-ads-editorial__content {
  padding: 28px 28px 16px;
  text-align: center;
}
.landing-ads-editorial__content .landing-ads-actions {
  justify-content: center;
}

/* ── STORY ── */
.landing-ads-modal--story {
  max-width: 440px;
  min-height: 520px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.landing-ads-story__bg {
  position: absolute;
  inset: 0;
}
.landing-ads-story__bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.landing-ads-story__content {
  position: relative;
  z-index: 2;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
  padding: 36px 24px 20px;
}

/* ── TRANSITION ── */
.landing-ads-fade-enter-active,
.landing-ads-fade-leave-active {
  transition: opacity 0.3s ease;
}
.landing-ads-fade-enter-from,
.landing-ads-fade-leave-to {
  opacity: 0;
}

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .landing-ads-modal--spotlight {
    grid-template-columns: 1fr;
  }
  .landing-ads-spotlight__image {
    grid-column: 1;
    grid-row: 1;
    max-height: 220px;
  }
  .landing-ads-spotlight__content {
    grid-column: 1;
    grid-row: 2;
    padding: 20px 18px;
  }
  .landing-ads-modal--story {
    max-width: 100%;
    min-height: 420px;
  }
}
</style>
