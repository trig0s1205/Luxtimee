<script setup lang="ts">
import type { HomepageConfigDto } from '@luxtime/shared';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';
import { shouldShowFounderSection } from '~/utils/homepage-config';

const catalog = useCatalogData();
const { observe } = useRevealObserver();
const { fetchConfig, DEFAULT_HOMEPAGE_CONFIG } = useHomepageConfig();

const { data: heroWatches, refresh: refreshHero } = await useCachedAsyncData(
  'home-hero-spotlight',
  () => catalog.getHeroSpotlight(6),
  { staleTime: 30_000 },
);

const { data: limitedWatches } = useCachedAsyncData(
  'home-limited-editions',
  async () => {
    const res = await catalog.listCatalog({ limit: 24, available: 'true' });
    return res.data.filter((w) => w.isLimitedEdition && w.stock > 0);
  },
  { server: false, lazy: true, staleTime: STOREFRONT_CACHE_MS.catalog },
);
const { data: homeCms } = await useCachedAsyncData<HomepageConfigDto>(
  'home-cms-config',
  () => fetchConfig(),
  { default: (): HomepageConfigDto => structuredClone(DEFAULT_HOMEPAGE_CONFIG), staleTime: STOREFRONT_CACHE_MS.catalog },
);

const cms = computed<HomepageConfigDto>(() => homeCms.value ?? DEFAULT_HOMEPAGE_CONFIG);

const config = useRuntimeConfig();
const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '');

useSeoMeta({
  title: 'Relojes de lujo en Bucaramanga | LUXTIMEE',
  description:
    'Relojes de lujo en Bucaramanga y Colombia. Stock real, catálogo online y compra segura por WhatsApp. Envíos a todo el país.',
  ogTitle: 'Relojes de lujo en Bucaramanga | LUXTIMEE',
  ogDescription:
    'Relojes de lujo en Bucaramanga y Colombia. Stock real, catálogo online y compra segura por WhatsApp.',
  ogType: 'website',
  ogUrl: siteUrl ? `${siteUrl}/` : undefined,
  twitterCard: 'summary_large_image',
});

useHead({
  meta: [
    {
      name: 'keywords',
      content:
        'relojes bucaramanga, relojes de lujo bucaramanga, relojes lujo colombia, luxury watches colombia, luxtimee',
    },
  ],
  script: siteUrl
    ? [{
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: 'LUXTIMEE',
          url: `${siteUrl}/`,
          description:
            'Tienda de relojes de lujo en Bucaramanga, Colombia. Stock real y venta online con confirmación por WhatsApp.',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Bucaramanga',
            addressRegion: 'Santander',
            addressCountry: 'CO',
          },
          areaServed: { '@type': 'Country', name: 'Colombia' },
        }),
      }]
    : [],
});

onMounted(() => {
  void refreshHero();
  nextTick(() => observe());
});

watch(heroWatches, () => {
  nextTick(() => observe());
});
</script>

<template>
  <div>
    <CatalogHomeHeroSpotlight v-if="heroWatches?.length" :watches="heroWatches" />

    <ClientOnly>
      <CatalogLimitedEditionPromo
        v-if="limitedWatches?.length"
        :watches="limitedWatches"
      />
    </ClientOnly>

    <HomeFeaturedSection
      v-if="cms.featured.enabled"
      :config="cms.featured"
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
