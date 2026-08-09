<script setup lang="ts">
const route = useRoute();
const scrolled = ref(false);
const menuOpen = ref(false);
const cart = useCartStore();
const { openCart } = useCartDrawer();
const { t, showSwitcher } = useLocale();

const navLinks = computed(() => [
  { label: t('nav.collection'), to: '/catalogo' },
  { label: t('nav.wholesale'), to: '/mayoristas' },
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

async function onLogoClick(event: MouseEvent) {
  event.preventDefault();
  closeMenu();
  if (route.path !== '/' || route.hash) {
    await navigateTo('/');
  }
  await nextTick();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <NuxtLink to="/" class="nav-logo" @click="onLogoClick">
      <span class="nav-logo__frame">
        <img
          src="/images/logo-luxtimee.png"
          alt="LuxTimee"
          class="nav-logo__img"
          width="140"
          height="40"
        >
      </span>
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
        :aria-label="`${t('nav.bag')} (${cart.unitCount})`"
        @click="openCart"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6 6h15l-1.5 9h-12z" />
          <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M6 6L5 3H2" />
        </svg>
        <span class="nav-cart__label">{{ t('nav.bag') }} ({{ cart.unitCount }})</span>
        <span v-if="cart.unitCount > 0" class="nav-cart__badge">{{ cart.unitCount }}</span>
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
  </div>
</template>
