<script setup lang="ts">
const route = useRoute();
const scrolled = ref(false);
const navIntro = ref(false);
const menuOpen = ref(false);
const retailCart = useCartStore();
const wholesaleCart = useWholesaleCartStore();
const { openCart } = useCartDrawer();
const { showWholesaleNavCart, isWholesaleCatalogArea } = useWholesaleNav();
const { t, showSwitcher } = useLocale();
const { showBack, goBack } = useStorefrontBack();
const { scrollToHomeSection } = useHomeSectionNav();

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

type NavLinkItem = { label: string; to: string; highlight?: boolean; sectionId?: string };

const navLinks = computed<NavLinkItem[]>(() => [
  { label: t('nav.collection'), to: '/catalogo', highlight: true },
  { label: t('nav.wholesale'), to: '/mayoristas' },
  { label: t('nav.about'), to: '/', sectionId: 'nosotros' },
  { label: t('nav.contact'), to: '/', sectionId: 'contacto' },
]);

async function onNavLinkClick(link: NavLinkItem, event: MouseEvent) {
  if (!link.sectionId) return;
  event.preventDefault();
  closeMenu();
  await scrollToHomeSection(link.sectionId);
}

function onMobileNavClick(link: NavLinkItem, event: MouseEvent) {
  if (link.sectionId) {
    void onNavLinkClick(link, event);
    return;
  }
  closeMenu();
}

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
  requestAnimationFrame(() => {
    navIntro.value = true;
  });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

watch(() => route.fullPath, closeMenu);
</script>

<template>
  <nav
    id="navbar"
    class="site-nav"
    :class="{ scrolled, 'site-nav--subpage': showBack, 'site-nav--intro': navIntro }"
  >
    <div class="nav-start">
      <NuxtLink to="/" class="nav-logo" @click="onLogoClick">
        <span class="nav-logo__frame">
          <svg
            class="nav-logo__img"
            viewBox="0 0 248 44"
            width="148"
            height="40"
            role="img"
            aria-label="LUXTIMEE"
          >
            <g fill="currentColor">
              <path d="M18.2 1.2c.28-.64 1.16-.64 1.44 0l1.12 2.5 2.72.28c.68.07.96.9.46 1.36l-2.1 1.92.6 2.68c.15.66-.54 1.16-1.14.82l-2.38-1.42-2.38 1.42c-.6.34-1.29-.16-1.14-.82l.6-2.68-2.1-1.92c-.5-.46-.22-1.29.46-1.36l2.72-.28 1.12-2.5Z" />
              <path d="M11 13.4h6.8v2.05h-4.05V36.6h16.4V40.4H11z" />
              <text
                x="34.5"
                y="34.6"
                font-family="Montserrat, Helvetica, sans-serif"
                font-size="13.5"
                font-weight="500"
                letter-spacing="3.6"
              >UXTIMEE</text>
            </g>
          </svg>
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
        <NuxtLink
          :to="link.to"
          :class="{ 'nav-link--catalog': link.highlight }"
          @click="onNavLinkClick(link, $event)"
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>

    <div class="nav-actions">
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
      :class="{ 'nav-menu-mobile__link--catalog': link.highlight }"
      @click="onMobileNavClick(link, $event)"
    >
      {{ link.label }}
    </NuxtLink>
  </div>
</template>
