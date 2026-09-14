<script setup lang="ts">
import type { HomepageFaqConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageFaqConfig }>();

const visibleItems = computed(() =>
  props.config.items.filter((item) => item.question.trim() && item.answer.trim()),
);
</script>

<template>
  <section v-if="visibleItems.length" id="faq" class="home-faq reveal">
    <div class="home-faq__veil" aria-hidden="true" />
    <div class="home-faq__inner">
      <header class="home-faq__head">
        <p v-if="config.label" class="home-faq__label">{{ config.label }}</p>
        <h2 class="home-faq__title">
          {{ config.title }}
          <em v-if="config.titleEm">{{ config.titleEm }}</em>
        </h2>
      </header>
      <UiFaqAccordion :items="visibleItems" variant="luxury" />
    </div>
  </section>
</template>

<style scoped>
.home-faq {
  position: relative;
  padding: clamp(4.5rem, 10vw, 7rem) clamp(1.25rem, 5vw, 4rem);
  background: var(--black);
  color: var(--white);
  overflow: hidden;
}

.home-faq__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 50% 0%, rgba(200, 169, 110, 0.12), transparent 60%),
    radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200, 169, 110, 0.06), transparent 55%);
}

.home-faq__inner {
  position: relative;
  z-index: 1;
  max-width: 920px;
  margin: 0 auto;
}

.home-faq__head {
  text-align: center;
  margin-bottom: clamp(2rem, 5vw, 3.25rem);
}

.home-faq__label {
  margin: 0 0 0.75rem;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--gold);
}

.home-faq__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 400;
  line-height: 1.15;
  color: var(--white);
}

.home-faq__title em {
  display: block;
  margin-top: 0.2rem;
  font-style: italic;
  color: var(--gold-light);
}
</style>
