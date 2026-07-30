<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';

const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();

const { data: heroWatches } = await useAsyncData('home-best-sellers', () => catalog.getBestSellers(6));
const { data: homeCms } = await useAsyncData<HomepageConfigDto>(
  'home-cms-config',
  () => fetchConfig(),
  { default: () => structuredClone(DEFAULT_HOMEPAGE_CONFIG) },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);

useSeoMeta({
  title: 'Luxtime — Luxury Timepieces',
  description: 'Catálogo premium de relojes de lujo. Luxtime Luxury Timepieces.',
  ogTitle: 'Luxtime — Luxury Timepieces',
  ogDescription: 'Catálogo premium de relojes de lujo. Compra asesorada por WhatsApp.',
});

onMounted(() => {
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <!-- Hero intacto: spotlight best-sellers -->
    <CatalogHomeHeroSpotlight v-if="heroWatches?.length" :watches="heroWatches" />

    <HomeFeaturedSection
      v-if="cms.featured.enabled"
      :config="cms.featured"
    />

    <HomeAboutFounderSection
      v-if="cms.founder.enabled"
      :config="cms.founder"
    />

    <HomeValuePropsSection
      v-if="cms.valueProps.enabled && cms.valueProps.items.length"
      :config="cms.valueProps"
    />

    <HomeStatementSection
      v-if="cms.statement.enabled"
      :config="cms.statement"
    />

    <HomeContactSection
      v-if="cms.contact.enabled"
      :config="cms.contact"
    />
  </div>
</template>
