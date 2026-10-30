<script setup lang="ts">
import type { HomepageConfigDto, WatchPublicDto } from '@luxtime/shared';

import { HOME_CMS_ASYNC_KEY, STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';
import { getActiveHeroSlides, shouldShowFounderSection } from '~/utils/homepage-config';
import { faqPageJsonLd } from '~/utils/seo';

definePageMeta({ mainClass: 'main--home-hero' });

const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();
const catalog = useCatalogData();

const featuredAsync = useCachedAsyncData<WatchPublicDto[]>(
  'home-featured-watches',
  async () => {
    try {
      const res = await catalog.listCatalog({ limit: 8, available: 'true', sort: 'newest' });
      return res.data.filter((watch) => watch.stock > 0).slice(0, 8);
    } catch (error) {
      console.error('[home] no se pudo cargar el destacado', error);
      return [];
    }
  },
  {
    lazy: import.meta.client,
    default: () => [],
    staleTime: STOREFRONT_CACHE_MS.catalog,
  },
);

const homeAsync = useCachedAsyncData<HomepageConfigDto>(
  HOME_CMS_ASYNC_KEY,
  () => fetchConfig(),
  {
    lazy: import.meta.client,
    default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG),
    staleTime: STOREFRONT_CACHE_MS.homepage,
  },
);

const { data: featuredData, pending: featuredPending, refresh: refreshFeatured } = featuredAsync;
const { data: homeCms } = homeAsync;

await Promise.all([homeAsync, featuredAsync]);

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
  if ((featuredData.value?.length ?? 0) > 0) void refreshFeatured();
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
      :watches="featuredData || []"
      :pending="featuredPending"
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
