<script setup lang="ts">
import type { FaqItem } from '@luxtime/shared';

const props = withDefaults(defineProps<{
  items: FaqItem[];
  variant?: 'gold' | 'default';
  singleOpen?: boolean;
}>(), {
  variant: 'default',
  singleOpen: true,
});

const openIndexes = ref<Set<number>>(new Set());

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
    >
      <button
        type="button"
        class="faq-accordion__trigger"
        :aria-expanded="isOpen(index)"
        @click="toggle(index)"
      >
        <span class="faq-accordion__question">{{ item.question }}</span>
        <span class="faq-accordion__icon" aria-hidden="true" />
      </button>
      <div v-show="isOpen(index)" class="faq-accordion__panel">
        <p class="faq-accordion__answer">{{ item.answer }}</p>
      </div>
    </div>
  </div>
</template>
