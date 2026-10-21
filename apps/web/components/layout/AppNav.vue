<script setup lang="ts">
import { HOME_CMS_ASYNC_KEY, STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const route = useRoute();
const navEl = ref<HTMLElement | null>(null);
const scrolled = ref(false);
const navIntro = ref(false);
const menuOpen = ref(false);
const retailCart = useCartStore();
const wholesaleCart = useWholesaleCartStore();
const { openCart } = useCartDrawer();
const { showWholesaleNavCart, isWholesaleCatalogArea } = useWholesaleNav();
const { t, showSwitcher } = useLocale();
const { scrollToHomeSection } = useHomeSectionNav();
const { fetchConfig } = useHomepageConfig();
const { resolve: resolveMedia } = useMediaUrl();

const { data: homeCms } = useCachedAsyncData(
  HOME_CMS_ASYNC_KEY,
  () => fetchConfig(),
  { server: false, lazy: true, staleTime: STOREFRONT_CACHE_MS.homepage },
);

const navLogoUrl = computed(() => homeCms.value?.branding?.navLogoUrl?.trim() || '');

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

let navResize: ResizeObserver | null = null;

function syncNavHeight() {
  if (scrolled.value) return;
  const height = navEl.value?.offsetHeight;
  if (!height) return;
  document.documentElement.style.setProperty('--site-nav-height', `${height}px`);
}

onMounted(() => {
  retailCart.hydrate();
  wholesaleCart.hydrate();
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  syncNavHeight();
  if (navEl.value) {
    navResize = new ResizeObserver(syncNavHeight);
    navResize.observe(navEl.value);
  }
  requestAnimationFrame(() => {
    navIntro.value = true;
  });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
  navResize?.disconnect();
});

watch(() => route.fullPath, closeMenu);
</script>

<template>
  <nav
    id="navbar"
    ref="navEl"
    class="site-nav"
    :class="{ scrolled, 'site-nav--intro': navIntro }"
  >
    <div class="nav-start">
      <NuxtLink v-if="navLogoUrl" to="/" class="nav-logo" @click="onLogoClick">
        <span class="nav-logo__frame">
          <img
            :src="resolveMedia(navLogoUrl)"
            alt="LUXTIMEE"
            class="nav-logo__img"
            width="179"
            height="46"
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
