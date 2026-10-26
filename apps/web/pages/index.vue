<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';

import { HOME_CMS_ASYNC_KEY, STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';
import { getActiveHeroSlides, shouldShowFounderSection } from '~/utils/homepage-config';
import { faqPageJsonLd } from '~/utils/seo';

definePageMeta({ mainClass: 'main--home-hero' });

const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();
const { data: homeCms, refresh: refreshHomeCms } = await useCachedAsyncData<HomepageConfigDto>(
  HOME_CMS_ASYNC_KEY,
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: STOREFRONT_CACHE_MS.homepage },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);

usePageSeo(() => {
  const faq = cms.value.faq;
  if (!faq?.enabled) return {};
  const node = faqPageJsonLd(faq.items ?? []);
  return node ? { jsonLd: [node] } : {};
});

const heroSlides = computed(() => getActiveHeroSlides(cms.value.hero));
const showPromoHero = computed(
  () => heroSlides.value.length > 0 && cms.value.hero.enabled !== false,
);

onMounted(() => {
  void refreshHomeCms();
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <h1 class="sr-only">Relojes de lujo en Bucaramanga y Piedecuesta</h1>
    <div class="home-hero-wrap">
      <HomePromoHero
        v-if="showPromoHero"
        :config="cms.hero"
      />
    </div>

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

<style scoped>
.home-hero-wrap {
  position: relative;
}
</style>
