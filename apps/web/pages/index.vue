<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';

import { HOME_CMS_ASYNC_KEY, STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';
import { getActiveHeroSlides, shouldShowFounderSection } from '~/utils/homepage-config';

definePageMeta({ mainClass: 'main--home-hero' });

const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();
const { data: homeCms, refresh: refreshHomeCms } = await useCachedAsyncData<HomepageConfigDto>(
  HOME_CMS_ASYNC_KEY,
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: STOREFRONT_CACHE_MS.homepage },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);
const heroSlides = computed(() => getActiveHeroSlides(cms.value.hero));
const showPromoHero = computed(
  () => heroSlides.value.length > 0 && cms.value.hero.enabled !== false,
);

useSeoMeta({
  title: 'LUXTIMEE — Luxury Timepieces',
  description: 'Relojes de lujo con stock real en Colombia. Compra online y confirma por WhatsApp.',
  ogTitle: 'LUXTIMEE — Luxury Timepieces',
  ogDescription: 'Relojes de lujo con stock real en Colombia. Compra online y confirma por WhatsApp.',
});

onMounted(() => {
  void refreshHomeCms();
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <HomePromoHero
      v-if="showPromoHero"
      :config="cms.hero"
    />

    <ClientOnly>
      <HomeLandingAdsModal
        v-if="cms.landingAds?.some((a) => a.enabled)"
        :ads="cms.landingAds"
      />
    </ClientOnly>

    <HomeFeaturedSection
      v-if="cms.featured.enabled"
      :config="cms.featured"
      :flush-top="showPromoHero"
    />

    <LazyHomeAboutFounderSection
      v-if="shouldShowFounderSection(cms.founder)"
      :config="cms.founder"
    />

    <HomeCustomerProofSection
      v-if="cms.customerProof.enabled"
      :config="cms.customerProof"
    />

    <LazyHomeFaqSection
      v-if="cms.faq.enabled"
      :config="cms.faq"
    />

    <LazyHomeContactSection
      v-if="cms.contact.enabled"
      :config="cms.contact"
    />
  </div>
</template>
