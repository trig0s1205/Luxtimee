<script setup lang="ts">
import type { HomepageHeroConfig } from '@luxtime/shared';
import type { WatchPublicDto } from '@luxtime/shared';

const props = defineProps<{
  config: HomepageHeroConfig;
  watches: WatchPublicDto[];
}>();

const { openChat } = useWhatsApp();
</script>

<template>
  <div>
    <CatalogHomeHeroSpotlight v-if="props.watches.length" :watches="props.watches" />

    <section v-else id="hero" class="section lux-hero-cms" :style="props.config.backgroundImageUrl ? `background-image: url('${props.config.backgroundImageUrl}')` : ''">
      <div class="lux-hero-cms__overlay" aria-hidden="true" />
      <div class="lux-hero-cms__content">
        <p class="lux-hero-cms__eyebrow">{{ props.config.eyebrow }}</p>
        <h1 class="lux-hero-cms__title">
          <span>LU<span class="gold">X</span>TIME</span>
        </h1>
        <p class="lux-hero-cms__title2">{{ props.config.title }}</p>
        <p class="lux-hero-cms__subtitle">{{ props.config.subtitle }}</p>
        <div class="lux-hero-cms__divider" />
        <div class="lux-hero-cms__cta">
          <NuxtLink :to="props.config.ctaLink || '/catalogo'" class="btn-primary">
            {{ props.config.ctaText || 'Ver catálogo' }}
          </NuxtLink>
          <button type="button" class="btn-ghost" @click="openChat('Hola LUXTIMEE, me gustaría saber más sobre el catálogo.')">
            Contactar
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lux-hero-cms {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-size: cover;
  background-position: center;
}

.lux-hero-cms__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.7) 100%);
  pointer-events: none;
}

.lux-hero-cms__content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 820px;
}

.lux-hero-cms__eyebrow {
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 1.5rem;
}

.lux-hero-cms__title {
  font-family: var(--font-display);
  font-size: clamp(4rem, 12vw, 10rem);
  font-weight: 300;
  letter-spacing: 0.08em;
  line-height: 1;
  color: var(--white);
  margin-bottom: 0.5rem;
}

.lux-hero-cms__title2 {
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 3vw, 2rem);
  font-weight: 300;
  font-style: italic;
  color: var(--gold-light);
  margin-bottom: 0.75rem;
}

.lux-hero-cms__subtitle {
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--white-dim);
  margin-bottom: 2rem;
}

.lux-hero-cms__divider {
  width: 60px;
  height: 1px;
  background: var(--gold);
  margin: 0 auto 2rem;
  opacity: 0.5;
}

.lux-hero-cms__cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
