<script setup lang="ts">
const route = useRoute();
const scrolled = ref(false);
const menuOpen = ref(false);
const retailCart = useCartStore();
const wholesaleCart = useWholesaleCartStore();
const { openCart } = useCartDrawer();
const { showWholesaleNavCart, isWholesaleCatalogArea } = useWholesaleNav();
const { t, showSwitcher } = useLocale();
const { showBack, goBack } = useStorefrontBack();

const showNavCart = computed(() => {
  if (route.path.startsWith('/mayoristas')) return showWholesaleNavCart.value;
  return true;
});

const cartUnitCount = computed(() => (
  isWholesaleCatalogArea.value ? wholesaleCart.unitCount : retailCart.unitCount
));

function openActiveCart() {
  openCart(isWholesaleCatalogArea.value ? 'wholesale' : 'retail');
}

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
  retailCart.hydrate();
  wholesaleCart.hydrate();
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

watch(() => route.fullPath, closeMenu);
</script>

<template>
  <nav id="navbar" class="site-nav" :class="{ scrolled, 'site-nav--subpage': showBack }">
    <div class="nav-start">
      <button
        v-if="showBack"
        type="button"
        class="nav-back"
        :aria-label="t('nav.back')"
        @click="goBack"
      >
        <UiBackArrowIcon />
        <span class="nav-back__label">{{ t('nav.back') }}</span>
      </button>

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
    </div>

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
      <LayoutThemeToggle />
      <LayoutLocaleSwitcher v-if="showSwitcher" />
      <button
        v-if="showNavCart"
        type="button"
        class="nav-cart"
        :class="{ 'has-items': cartUnitCount > 0 }"
        :aria-label="`${t('nav.bag')} (${cartUnitCount})`"
        @click="openActiveCart"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6 6h15l-1.5 9h-12z" />
          <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M6 6L5 3H2" />
        </svg>
        <span class="nav-cart__label">{{ t('nav.bag') }} ({{ cartUnitCount }})</span>
        <span v-if="cartUnitCount > 0" class="nav-cart__badge">{{ cartUnitCount }}</span>
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
