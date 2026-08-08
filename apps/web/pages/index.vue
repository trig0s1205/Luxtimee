<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();

const { data: heroWatches } = await useCachedAsyncData(
  'home-best-sellers',
  () => catalog.getBestSellers(6),
  { staleTime: STOREFRONT_CACHE_MS.catalog },
);
const { data: homeCms } = await useCachedAsyncData<HomepageConfigDto>(
  'home-cms-config',
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: STOREFRONT_CACHE_MS.static },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);

useSeoMeta({
  title: 'LUXTIMEE — Luxury Timepieces',
  description: 'Catálogo premium de relojes de lujo. LUXTIMEE Luxury Timepieces.',
  ogTitle: 'LUXTIMEE — Luxury Timepieces',
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
