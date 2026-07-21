<template>
  <div class="min-h-screen bg-lux-black">
    <LayoutAppNav />
    <main class="pt-28">
      <slot />
    </main>
    <LayoutAppFooter />
    <LayoutWhatsAppFloat />
    <LayoutCartDrawer />
    <CatalogProductDetailModal />
    <LayoutCookieConsent />
  </div>
</template>

<script setup lang="ts">
useRevealObserver();
</script>
