<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = defineProps<{
  watches: WatchPublicDto[];
}>();

const STORAGE_KEY = 'luxtimee-limited-promo-v1';

const { t } = useLocale();
const { openProduct } = useProductModal();
const { watchPrimaryImage } = useMediaUrl();

const visible = ref(false);
const picked = ref<WatchPublicDto | null>(null);

const imageUrl = computed(() => (picked.value ? watchPrimaryImage(picked.value) : null));

const description = computed(() => {
  const watch = picked.value;
  if (!watch) return '';
  const text = watch.description?.trim();
  if (text) return text;
  return t('home.limitedPromoFallback');
});

const stockLine = computed(() => {
  const watch = picked.value;
  if (!watch || watch.stock <= 0) return null;
  return t('home.limitedPromoStock').replace('{n}', String(watch.stock));
});

const editionLine = computed(() => {
  const watch = picked.value;
  if (!watch?.limitedEditionNumber?.trim()) return null;
  return watch.limitedEditionNumber.trim();
});

function close() {
  visible.value = false;
  if (import.meta.client) {
    sessionStorage.setItem(STORAGE_KEY, '1');
    document.body.style.overflow = '';
  }
}

function openWatch() {
  if (!picked.value) return;
  close();
  openProduct(picked.value.slug);
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) close();
}

onMounted(() => {
  if (!import.meta.client || !props.watches.length) return;
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const idx = Math.floor(Math.random() * props.watches.length);
  picked.value = props.watches[idx] ?? null;
  if (!picked.value) return;

  visible.value = true;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="limited-promo-fade">
      <div
        v-if="visible && picked"
        class="limited-promo"
        role="dialog"
        aria-modal="true"
        :aria-label="t('home.limitedPromoTitle')"
        @click="onOverlayClick"
      >
        <div class="limited-promo__panel">
          <button
            type="button"
            class="limited-promo__close"
            :aria-label="t('home.limitedPromoClose')"
            @click="close"
          >
            ×
          </button>

          <div class="limited-promo__glow" aria-hidden="true" />

          <div class="limited-promo__visual">
            <span class="limited-promo__eyebrow">{{ t('home.limitedPromoEyebrow') }}</span>
            <span class="limited-promo__badge">{{ t('home.limitedPromoTitle') }}</span>
            <div class="limited-promo__image-wrap">
              <img
                v-if="imageUrl"
                :src="imageUrl"
                :alt="`${picked.brand.name} ${picked.model}`"
                class="limited-promo__image"
              >
              <div v-else class="limited-promo__placeholder" />
            </div>
          </div>

          <div class="limited-promo__copy">
            <p class="limited-promo__brand">{{ picked.brand.name }}</p>
            <h2 class="limited-promo__title">{{ picked.model }}</h2>
            <p v-if="editionLine" class="limited-promo__edition">{{ editionLine }}</p>
            <p class="limited-promo__desc">{{ description }}</p>
            <p v-if="stockLine" class="limited-promo__stock">{{ stockLine }}</p>
            <p class="limited-promo__price">{{ formatCop(picked.retailPrice) }}</p>
            <button type="button" class="limited-promo__cta" @click="openWatch">
              {{ t('home.limitedPromoCta') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.limited-promo {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.limited-promo__panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  width: min(920px, 100%);
  max-height: min(90vh, 720px);
  overflow: hidden;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: linear-gradient(145deg, rgba(18, 18, 18, 0.98), rgba(8, 8, 8, 0.98));
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
}

.limited-promo__glow {
  position: absolute;
  inset: auto -20% -40% -20%;
  height: 55%;
  background: radial-gradient(circle, rgba(200, 169, 110, 0.22), transparent 70%);
  pointer-events: none;
}

.limited-promo__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 3;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: var(--white);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.limited-promo__close:hover {
  border-color: rgba(200, 169, 110, 0.65);
  color: var(--gold-light);
}

.limited-promo__visual {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem 1.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(200, 169, 110, 0.08), transparent 55%);
}

.limited-promo__eyebrow {
  font-family: var(--font-body);
  font-size: 0.62rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--gold-light);
  margin-bottom: 0.5rem;
}

.limited-promo__badge {
  margin-bottom: 1rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(200, 169, 110, 0.55);
  background: rgba(200, 169, 110, 0.12);
  font-family: var(--font-body);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold-light);
}

.limited-promo__image-wrap {
  width: min(100%, 280px);
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.limited-promo__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.55));
}

.limited-promo__placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.06);
}

.limited-promo__copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.65rem;
  padding: 2rem 2rem 2rem 1.75rem;
  overflow-y: auto;
}

.limited-promo__brand {
  font-family: var(--font-body);
  font-size: 0.68rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.limited-promo__title {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.35rem);
  font-weight: 400;
  line-height: 1.1;
  color: var(--white);
}

.limited-promo__edition {
  font-family: var(--font-body);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold-light);
}

.limited-promo__desc {
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.78);
  max-width: 36ch;
}

.limited-promo__stock {
  font-family: var(--font-body);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-light);
}

.limited-promo__price {
  margin-top: 0.25rem;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 1.9rem);
  color: var(--white);
}

.limited-promo__cta {
  align-self: flex-start;
  margin-top: 0.5rem;
  padding: 0.85rem 1.5rem;
  border: 1px solid rgba(200, 169, 110, 0.65);
  background: linear-gradient(135deg, rgba(200, 169, 110, 0.22), rgba(200, 169, 110, 0.08));
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gold-light);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.limited-promo__cta:hover {
  transform: translateY(-1px);
  border-color: rgba(200, 169, 110, 0.95);
  background: linear-gradient(135deg, rgba(200, 169, 110, 0.32), rgba(200, 169, 110, 0.12));
}

.limited-promo-fade-enter-active,
.limited-promo-fade-leave-active {
  transition: opacity 0.28s ease;
}

.limited-promo-fade-enter-from,
.limited-promo-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .limited-promo {
    padding: 0.75rem;
    align-items: flex-end;
  }

  .limited-promo__panel {
    grid-template-columns: 1fr;
    max-height: min(92vh, 760px);
  }

  .limited-promo__visual {
    padding: 1.25rem 1rem 0.75rem;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .limited-promo__image-wrap {
    width: min(72vw, 220px);
    aspect-ratio: 1 / 1;
  }

  .limited-promo__copy {
    padding: 1.25rem 1.25rem 1.5rem;
  }

  .limited-promo__desc {
    font-size: 0.86rem;
    max-width: none;
  }

  .limited-promo__cta {
    width: 100%;
    text-align: center;
  }
}
</style>
