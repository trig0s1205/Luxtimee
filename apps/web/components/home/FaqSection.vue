<script setup lang="ts">
import type { HomepageFaqConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageFaqConfig }>();

const visibleItems = computed(() =>
  props.config.items.filter((item) => item.question.trim() && item.answer.trim()),
);
</script>

<template>
  <section v-if="visibleItems.length" class="statement-section faq-section reveal">
    <div class="faq-section__head">
      <p v-if="config.label" class="faq-section__label">{{ config.label }}</p>
      <h2 class="faq-section__title">
        {{ config.title }}
        <em v-if="config.titleEm">{{ config.titleEm }}</em>
      </h2>
    </div>
    <div class="faq-section__body">
      <UiFaqAccordion :items="visibleItems" variant="gold" />
    </div>
  </section>
</template>
