<script setup lang="ts">
import type { HomepageFeaturedConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageFeaturedConfig }>();
</script>

<template>
  <section id="coleccion" class="lux-collection reveal">
    <div class="lux-collection__glow" aria-hidden="true" />
    <div class="lux-collection__inner">
      <div class="lux-collection__copy">
        <p class="lux-collection__label">{{ props.config.label }}</p>
        <h2 class="lux-collection__title">
          {{ props.config.titleLead }}
          <em>{{ props.config.titleEm }}</em>
        </h2>
        <p class="lux-collection__intro">{{ props.config.intro }}</p>
      </div>
      <NuxtLink :to="props.config.ctaLink || '/catalogo'" class="lux-collection__cta">
        {{ props.config.ctaText || 'Ver catálogo completo' }}
        <span aria-hidden="true">→</span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.lux-collection {
  position: relative;
  padding: clamp(5rem, 10vw, 8.5rem) clamp(1.5rem, 6vw, 5rem);
  overflow: hidden;
  background: var(--black-2);
  border-top: 1px solid rgba(200, 169, 110, 0.1);
  border-bottom: 1px solid rgba(200, 169, 110, 0.08);
}

.lux-collection__glow {
  position: absolute;
  inset: 10% 5% auto auto;
  width: min(48vw, 520px);
  height: min(48vw, 520px);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(200, 169, 110, 0.12) 0%, transparent 68%);
  filter: blur(12px);
}

.lux-collection__inner {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: clamp(2rem, 5vw, 4rem);
  padding: clamp(2rem, 4vw, 3.25rem) clamp(1.5rem, 3.5vw, 3rem);
  border: 1px solid rgba(200, 169, 110, 0.16);
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0%, rgba(200, 169, 110, 0.04) 48%, rgba(10, 10, 10, 0.35) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}

.lux-collection__copy { max-width: 720px; min-width: 0; }

.lux-collection__label {
  margin: 0 0 1rem;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--gold);
}

.lux-collection__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 6.5vw, 5.5rem);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: 0.02em;
  color: var(--white);
}

.lux-collection__title em {
  display: inline-block;
  font-style: italic;
  color: var(--gold-light);
}

.lux-collection__intro {
  margin: 1.35rem 0 0;
  max-width: 38rem;
  font-family: var(--font-body);
  font-size: clamp(0.95rem, 1.4vw, 1.1rem);
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--white-dim);
}

.lux-collection__cta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.65rem;
  border-radius: 999px;
  border: 1px solid rgba(200, 169, 110, 0.45);
  background: linear-gradient(135deg, rgba(226, 201, 138, 0.95), rgba(154, 122, 69, 0.95));
  color: var(--black);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  transition: transform 0.35s ease, box-shadow 0.35s ease, filter 0.35s ease;
  box-shadow: 0 12px 32px rgba(200, 169, 110, 0.18);
  white-space: nowrap;
}

.lux-collection__cta span {
  font-size: 1rem;
  line-height: 1;
  transition: transform 0.35s ease;
}

.lux-collection__cta:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
  box-shadow: 0 16px 40px rgba(200, 169, 110, 0.28);
}

.lux-collection__cta:hover span {
  transform: translateX(3px);
}

@media (max-width: 900px) {
  .lux-collection__inner { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 768px) {
  .lux-collection { padding: 3.25rem 1.25rem; }
  .lux-collection__inner { padding: 1.5rem 1.25rem; }
  .lux-collection__cta { width: 100%; justify-content: center; }
}

@media (max-width: 480px) {
  .lux-collection { padding: 2.75rem 1rem; }
  .lux-collection__inner { padding: 1.25rem 1rem; gap: 1.5rem; }
  .lux-collection__title { font-size: clamp(2.25rem, 9vw, 3rem); }
}
</style>
