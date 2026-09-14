<script setup lang="ts">
import type { FaqItem } from '@luxtime/shared';

const props = withDefaults(defineProps<{
  items: FaqItem[];
  variant?: 'gold' | 'default' | 'luxury';
  singleOpen?: boolean;
}>(), {
  variant: 'default',
  singleOpen: true,
});

const openIndexes = ref<Set<number>>(new Set([0]));

function toggle(index: number) {
  if (props.singleOpen) {
    openIndexes.value = openIndexes.value.has(index) ? new Set() : new Set([index]);
    return;
  }

  const next = new Set(openIndexes.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  openIndexes.value = next;
}

function isOpen(index: number) {
  return openIndexes.value.has(index);
}
</script>

<template>
  <div class="faq-accordion" :class="`faq-accordion--${props.variant}`">
    <div
      v-for="(item, index) in props.items"
      :key="`${index}-${item.question}`"
      class="faq-accordion__item"
      :class="{ 'faq-accordion__item--open': isOpen(index) }"
      :style="{ '--faq-delay': `${index * 70}ms` }"
    >
      <button
        type="button"
        class="faq-accordion__trigger"
        :aria-expanded="isOpen(index)"
        @click="toggle(index)"
      >
        <span class="faq-accordion__index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="faq-accordion__question">{{ item.question }}</span>
        <span class="faq-accordion__icon" aria-hidden="true" />
      </button>
      <div class="faq-accordion__panel" :class="{ 'faq-accordion__panel--open': isOpen(index) }">
        <div class="faq-accordion__panel-inner">
          <p class="faq-accordion__answer">{{ item.answer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.faq-accordion__item {
  border: 1px solid rgba(200, 169, 110, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
  opacity: 0;
  transform: translateY(12px);
  animation: faq-item-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--faq-delay, 0ms);
  transition:
    border-color 0.35s ease,
    background 0.35s ease,
    box-shadow 0.35s ease;
}

.faq-accordion__item--open {
  border-color: rgba(200, 169, 110, 0.55);
  background: rgba(200, 169, 110, 0.06);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}

.faq-accordion__trigger {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.faq-accordion__index {
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--gold);
  opacity: 0.85;
}

.faq-accordion__question {
  font-family: var(--font-body);
  font-size: clamp(0.9rem, 1.6vw, 1rem);
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1.45;
  color: var(--white);
}

.faq-accordion__icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(200, 169, 110, 0.45);
  position: relative;
  flex-shrink: 0;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.35s ease;
}

.faq-accordion__icon::before,
.faq-accordion__icon::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 1px;
  background: var(--gold-light);
  transform: translate(-50%, -50%);
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.faq-accordion__icon::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.faq-accordion__item--open .faq-accordion__icon {
  transform: rotate(180deg);
  border-color: var(--gold);
}

.faq-accordion__item--open .faq-accordion__icon::after {
  opacity: 0;
  transform: translate(-50%, -50%) rotate(90deg) scaleX(0);
}

.faq-accordion__panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.faq-accordion__panel--open {
  grid-template-rows: 1fr;
}

.faq-accordion__panel-inner {
  overflow: hidden;
}

.faq-accordion__answer {
  margin: 0;
  padding: 0 1.25rem 1.25rem 3.35rem;
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--white-dim);
}

.faq-accordion--gold .faq-accordion__question {
  color: var(--black);
}

.faq-accordion--gold .faq-accordion__answer {
  color: rgba(10, 10, 10, 0.78);
}

@keyframes faq-item-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .faq-accordion__trigger {
    gap: 0.65rem;
    padding: 1rem;
  }

  .faq-accordion__answer {
    padding: 0 1rem 1rem 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .faq-accordion__item {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .faq-accordion__panel {
    transition: none;
  }

  .faq-accordion__icon {
    transition: none;
  }
}
</style>
