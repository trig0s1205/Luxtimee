<template>
  <div class="min-h-screen bg-lux-black">
    <LayoutAppNav />
    <main class="pt-28">
      <slot />
    </main>
    <LayoutAppFooter />
    <LayoutWhatsAppFloat />
    <LayoutCartDrawer />
    <LayoutStockNotice />
    <CatalogProductDetailModal />
    <StorefrontSocialProofToast />
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
