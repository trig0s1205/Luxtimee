<template>
  <div class="min-h-screen bg-lux-black overflow-x-clip">
    <UiStorefrontRouteProgress />
    <ClientOnly>
      <LazyLayoutLuxCursorTrail />
    </ClientOnly>
    <LayoutAppNav />
    <main :class="mainClass">
      <slot />
    </main>
    <LayoutAppFooter />
    <LayoutWhatsAppFloat />
    <LayoutCartDrawer />
    <LayoutStockNotice />
    <CatalogProductDetailModal />
    <ClientOnly>
      <LazyStorefrontSocialProofToast />
    </ClientOnly>
    <LayoutCookieConsent />
    <UiToastContainer />
    <UiConfirmDialog />
  </div>
</template>

<script setup lang="ts">
useRevealObserver();

const { locale } = useLocale();
const route = useRoute();

const mainClass = computed(() => {
  const custom = route.meta.mainClass;
  return typeof custom === 'string' ? custom : 'pt-28';
});

useHead(() => ({
  htmlAttrs: { lang: locale.value === 'es' ? 'es-CO' : 'en' },
}));
</script>
