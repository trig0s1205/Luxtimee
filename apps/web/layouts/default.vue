<template>
  <div class="min-h-screen bg-lux-black">
    <ClientOnly>
      <LazyLayoutLuxCursorTrail />
    </ClientOnly>
    <LayoutAppNav />
    <main class="pt-28">
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

useHead(() => ({
  htmlAttrs: { lang: locale.value === 'es' ? 'es-CO' : 'en' },
}));
</script>
