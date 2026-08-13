<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { LUXTIMEE_EXPERIENCE_ITEMS } from '~/constants/luxtime-experience';
import { SHIPPING_FULL_TEXT } from '~/constants/shipping-copy';
import { buildWatchTechSpecs, splitDescription } from '~/utils/watch-tech-sheet';

const props = withDefaults(defineProps<{
  watch: WatchPublicDto;
  inline?: boolean;
  compact?: boolean;
}>(), {
  inline: false,
  compact: false,
});

const descriptionParagraphs = computed(() => splitDescription(props.watch.description));
const techSpecs = computed(() => buildWatchTechSpecs(props.watch));
const careDescription = computed(() => {
  const care = props.watch.careTemplate;
  if (!care) return null;
  return { title: care.name, text: care.instructions };
});
</script>

<template>
  <section
    id="ficha-tecnica"
    class="watch-tech-sheet"
    :class="{
      'watch-tech-sheet--inline': inline,
      'watch-tech-sheet--compact': compact,
    }"
  >
    <header class="watch-tech-sheet__header">
      <p class="watch-tech-sheet__eyebrow">LUXTIMEE · Ficha técnica</p>
      <h2 v-if="!inline" class="watch-tech-sheet__title">{{ watch.brand.name }} {{ watch.model }}</h2>
    </header>

    <div v-if="descriptionParagraphs.length || careDescription" class="watch-tech-sheet__block">
      <h3 class="watch-tech-sheet__block-title">Descripción</h3>
      <div class="watch-tech-sheet__description">
        <p v-for="(paragraph, index) in descriptionParagraphs" :key="index">{{ paragraph }}</p>
        <p class="watch-tech-sheet__shipping">{{ SHIPPING_FULL_TEXT }}</p>
        <div v-if="careDescription" class="watch-tech-sheet__care">
          <p class="watch-tech-sheet__care-title">{{ careDescription.title }}</p>
          <p class="watch-tech-sheet__care-text">{{ careDescription.text }}</p>
        </div>
      </div>
    </div>

    <div v-if="techSpecs.length" class="watch-tech-sheet__block">
      <h3 class="watch-tech-sheet__block-title">Especificaciones</h3>
      <div class="watch-tech-sheet__grid">
        <article v-for="spec in techSpecs" :key="spec.label" class="watch-tech-sheet__spec">
          <p class="watch-tech-sheet__spec-label">{{ spec.label }}</p>
          <p class="watch-tech-sheet__spec-value">{{ spec.value }}</p>
        </article>
      </div>
    </div>

    <div class="watch-tech-sheet__block">
      <h3 class="watch-tech-sheet__block-title">Tu experiencia LUXTIMEE</h3>
      <div class="watch-tech-sheet__experience">
        <article v-for="item in LUXTIMEE_EXPERIENCE_ITEMS" :key="item.label" class="watch-tech-sheet__experience-card">
          <span class="watch-tech-sheet__experience-icon" aria-hidden="true">{{ item.icon }}</span>
          <p>{{ item.label }}</p>
        </article>
      </div>
    </div>

    <div v-if="watch.warrantyTemplate" class="watch-tech-sheet__block watch-tech-sheet__note">
      <h3 class="watch-tech-sheet__block-title">Garantía</h3>
      <p class="watch-tech-sheet__note-text">{{ watch.warrantyTemplate.terms }}</p>
    </div>
  </section>
</template>
