<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';

definePageMeta({ mainClass: 'main--home-hero' });
import { HOME_CMS_ASYNC_KEY, STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';
import { getActiveHeroSlides, shouldShowFounderSection } from '~/utils/homepage-config';

const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();

const { data: limitedWatches } = useCachedAsyncData(
  'home-limited-editions',
  async () => {
    const res = await catalog.listCatalog({ limit: 24, available: 'true' });
    return res.data.filter((w) => w.isLimitedEdition && w.stock > 0);
  },
  { server: false, lazy: true, staleTime: STOREFRONT_CACHE_MS.catalog },
);
const { data: homeCms, refresh: refreshHomeCms } = await useCachedAsyncData<HomepageConfigDto>(
  HOME_CMS_ASYNC_KEY,
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: STOREFRONT_CACHE_MS.homepage },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);
const heroSlides = computed(() => getActiveHeroSlides(cms.value.hero));
const showPromoHero = computed(() => cms.value.hero.enabled && heroSlides.value.length > 0);

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
      :slides="heroSlides"
    />

    <ClientOnly>
      <CatalogLimitedEditionPromo
        v-if="limitedWatches?.length"
        :watches="limitedWatches"
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
