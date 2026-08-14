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
const { data: homeCms, refresh: refreshHomeCms } = await useCachedAsyncData<HomepageConfigDto>(
  'home-cms-config',
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: 60_000 },
);

onMounted(() => {
  void refreshHomeCms();
});

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);

useSeoMeta({
  title: 'LUXTIMEE — Luxury Timepieces',
  description: 'Relojes de lujo con stock real en Colombia. Compra online y confirma por WhatsApp.',
  ogTitle: 'LUXTIMEE — Luxury Timepieces',
  ogDescription: 'Relojes de lujo con stock real en Colombia. Compra online y confirma por WhatsApp.',
});

onMounted(() => {
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <CatalogHomeHeroSpotlight v-if="heroWatches?.length" :watches="heroWatches" />

    <HomeFeaturedSection
      v-if="cms.featured.enabled"
      :config="cms.featured"
    />

    <LazyHomeAboutFounderSection
      v-if="cms.founder.enabled"
      :config="cms.founder"
    />

    <HomeCustomerProofSection
      v-if="cms.customerProof.enabled"
      :config="cms.customerProof"
    />

    <LazyHomeStatementSection
      v-if="cms.statement.enabled"
      :config="cms.statement"
    />

    <LazyHomeContactSection
      v-if="cms.contact.enabled"
      :config="cms.contact"
    />
  </div>
</template>
