<script setup lang="ts">
import type { HomepageValuePropsConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageValuePropsConfig }>();
</script>

<template>
  <section class="lux-values">
    <div class="lux-values__glow" aria-hidden="true" />
    <div class="lux-values__inner">
      <div class="lux-values__header reveal">
        <p class="lux-values__label">{{ props.config.label }}</p>
        <h2 class="lux-values__title">{{ props.config.title }}</h2>
      </div>

      <div class="lux-values__grid">
        <div
          v-for="(item, i) in props.config.items"
          :key="i"
          class="lux-values__item reveal"
          :style="{ transitionDelay: `${i * 0.12}s` }"
        >
          <div class="lux-values__icon">{{ item.icon }}</div>
          <h3 class="lux-values__item-title">{{ item.title }}</h3>
          <p class="lux-values__item-desc">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lux-values {
  position: relative;
  padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 6vw, 5rem);
  background: var(--black-2);
  overflow: hidden;
  border-top: 1px solid rgba(200, 169, 110, 0.08);
}

.lux-values__glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  height: 80vw;
  max-width: 900px;
  max-height: 900px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(200, 169, 110, 0.05) 0%, transparent 60%);
}

.lux-values__inner {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
}

.lux-values__header {
  text-align: center;
  margin-bottom: clamp(2.5rem, 5vw, 4rem);
}

.lux-values__label {
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 0.85rem;
}

.lux-values__title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 300;
  color: var(--white);
  letter-spacing: 0.02em;
}

.lux-values__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.lux-values__item {
  padding: 2.25rem 2rem;
  border: 1px solid rgba(200, 169, 110, 0.12);
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0%, rgba(200, 169, 110, 0.03) 100%);
  transition: border-color 0.4s ease, background 0.4s ease, transform 0.4s ease;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.lux-values__item:hover {
  border-color: rgba(200, 169, 110, 0.3);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(200, 169, 110, 0.06) 100%);
  transform: translateY(-4px);
}

.lux-values__icon {
  font-size: 1.35rem;
  color: var(--gold);
  line-height: 1;
}

.lux-values__item-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--white);
}

.lux-values__item-desc {
  font-family: var(--font-body);
  font-size: 0.875rem;
  line-height: 1.75;
  color: var(--white-dim);
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .lux-values { padding: 3.5rem 1.25rem; }
  .lux-values__grid { grid-template-columns: 1fr; }
}
</style>
