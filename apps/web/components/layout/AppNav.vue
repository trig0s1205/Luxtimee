<script setup lang="ts">
const route = useRoute();
const scrolled = ref(false);
const menuOpen = ref(false);
const cart = useCartStore();
const { openCart } = useCartDrawer();
const { t, showSwitcher } = useLocale();

const navLinks = computed(() => [
  { label: t('nav.collection'), to: '/catalogo' },
  { label: t('nav.about'), to: '/#nosotros' },
  { label: t('nav.contact'), to: '/#contacto' },
]);

function onScroll() {
  scrolled.value = window.scrollY > 60;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

onMounted(() => {
  cart.hydrate();
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

watch(() => route.fullPath, closeMenu);
</script>

<template>
  <nav id="navbar" class="site-nav" :class="{ scrolled }">
    <NuxtLink to="/" class="nav-logo" @click="closeMenu">
      LUX<span class="gold">TIME</span> ·
    </NuxtLink>

    <button
      type="button"
      class="navbar-hamburger"
      :class="{ active: menuOpen }"
      :aria-label="t('nav.menu')"
      @click="toggleMenu"
    >
      <span />
      <span />
      <span />
    </button>

    <ul class="nav-links">
      <li v-for="link in navLinks" :key="link.to">
        <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
      </li>
    </ul>

    <div class="nav-actions">
      <LayoutLocaleSwitcher v-if="showSwitcher" />
      <button
        type="button"
        class="nav-cart"
        :class="{ 'has-items': cart.unitCount > 0 }"
        @click="openCart"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6 6h15l-1.5 9h-12z" />
          <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M6 6L5 3H2" />
        </svg>
        {{ t('nav.bag') }} ({{ cart.unitCount }})
      </button>
    </div>
  </nav>

  <div id="nav-menu-mobile" class="nav-menu-mobile" :class="{ open: menuOpen }">
    <NuxtLink
      v-for="link in navLinks"
      :key="`m-${link.to}`"
      :to="link.to"
      @click="closeMenu"
    >
      {{ link.label }}
    </NuxtLink>
    <div v-if="showSwitcher" class="px-1 py-2">
      <LayoutLocaleSwitcher />
    </div>
    <button type="button" class="w-full text-left" @click="openCart(); closeMenu()">
      {{ t('nav.bag') }} ({{ cart.unitCount }})
    </button>
  </div>
</template>
