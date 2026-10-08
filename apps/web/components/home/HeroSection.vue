<script setup lang="ts">
import type { HomepageHeroConfig } from '@luxtime/shared';
import { getActiveHeroSlides } from '~/utils/homepage-config';

const props = defineProps<{
  config: HomepageHeroConfig;
}>();

const slides = computed(() => getActiveHeroSlides(props.config));
const show = computed(() => props.config.enabled && slides.value.length > 0);
</script>

<template>
  <HomePromoHero v-if="show" :config="config" />
</template>
