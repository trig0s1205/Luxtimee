<template>
  <div class="min-h-screen bg-lux-black">
    <LayoutAppNav />
    <main class="pt-24">
      <slot />
    </main>
    <LayoutAppFooter />
    <LayoutCookieConsent />
  </div>
</template>
