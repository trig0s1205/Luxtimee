<script setup lang="ts">
const scrolled = ref(false);
const cart = useCartStore();

onMounted(() => {
  cart.hydrate();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

const onScroll = () => {
  scrolled.value = window.scrollY > 40;
};
</script>

<template>
  <nav
    class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-16 transition-all duration-300"
    :class="scrolled ? 'py-4 bg-lux-black/95 border-b border-lux-gold/15' : 'py-7 bg-gradient-to-b from-lux-black/95 to-transparent'"
  >
    <NuxtLink to="/" class="font-display text-2xl tracking-[0.15em] text-lux-gold">
      LUX<span class="text-lux-white font-light">TIME</span>
    </NuxtLink>
    <ul class="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-lux text-lux-white-dim">
      <li><NuxtLink to="/catalogo" class="hover:text-lux-gold transition-colors">Catálogo</NuxtLink></li>
      <li><NuxtLink to="/design" class="hover:text-lux-gold transition-colors">Diseños</NuxtLink></li>
      <li><NuxtLink to="/ui-kit" class="hover:text-lux-gold transition-colors">UI Kit</NuxtLink></li>
    </ul>
    <NuxtLink to="/carrito" class="text-[11px] uppercase tracking-widest text-lux-white-dim hover:text-lux-gold transition-colors">
      Carrito ({{ cart.unitCount }})
    </NuxtLink>
  </nav>
</template>
