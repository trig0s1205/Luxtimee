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

onMounted(() => {
  void refreshHomeCms();
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <div class="home-hero-wrap">
      <HomePromoHero
        v-if="showPromoHero"
        :config="cms.hero"
      />
      <h1 class="home-hero-heading" :class="{ 'home-hero-heading--overlay': showPromoHero }">
        Relojes de lujo <em>LUXTIMEE</em>
      </h1>
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

.home-hero-heading {
  margin: 0;
  padding: 28px 24px 8px;
  font-family: var(--font-display, 'Cormorant Garamond', serif);
  font-weight: 300;
  font-size: clamp(2.25rem, 5vw, 4.25rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-align: center;
  color: var(--white, #f5f5f5);
}

.home-hero-heading em {
  font-style: italic;
  color: var(--gold, #c8a96e);
}

.home-hero-heading--overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 24px;
  z-index: 4;
  padding: 0 20px 8px;
  text-shadow: 0 8px 28px rgba(0, 0, 0, 0.72);
  pointer-events: none;
}
</style>
