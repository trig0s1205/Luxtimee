<script setup lang="ts">
import type { PlatformConfigDto } from '@luxtime/shared';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const { t } = useLocale();
const route = useRoute();
const apiBase = useApiBaseUrl();

const { data: platform } = await useCachedAsyncData('footer-platform', () =>
  $fetch<PlatformConfigDto>(`${apiBase}/settings/platform/public`).catch(() => ({
    supportEmail: 'help@luxtime.co',
    city: 'Piedecuesta, Santander — Colombia',
    instagramUrl: 'https://www.instagram.com/',
    tiktokUrl: 'https://www.tiktok.com/',
    facebookUrl: '',
  })),
  { staleTime: STOREFRONT_CACHE_MS.static },
);
</script>

<template>
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <p class="brand-name">LUXTIMEE</p>
        <p class="brand-tagline">Luxury Timepieces</p>
        <p>{{ t('footer.brandText') }}</p>
      </div>

      <div class="footer-col">
        <h4>{{ t('footer.collection') }}</h4>
        <ul>
          <li><NuxtLink to="/catalogo?category=deportivo">{{ t('footer.sport') }}</NuxtLink></li>
          <li><NuxtLink to="/catalogo?category=clasico">{{ t('footer.classics') }}</NuxtLink></li>
          <li><NuxtLink to="/catalogo?category=edicion-limitada">{{ t('footer.limited') }}</NuxtLink></li>
          <li><NuxtLink to="/catalogo">{{ t('footer.viewAll') }}</NuxtLink></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>{{ t('footer.legal') }}</h4>
        <ul>
          <li><NuxtLink to="/politica-de-privacidad">{{ t('footer.privacy') }}</NuxtLink></li>
          <li><NuxtLink to="/terminos-y-condiciones">{{ t('footer.terms') }}</NuxtLink></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>{{ t('footer.brand') }}</h4>
        <ul>
          <li><NuxtLink to="/#nosotros">{{ t('footer.story') }}</NuxtLink></li>
          <li><NuxtLink to="/#nosotros">{{ t('footer.aboutUs') }}</NuxtLink></li>
          <li><NuxtLink to="/mayoristas">{{ t('footer.wholesale') }}</NuxtLink></li>
          <li><NuxtLink to="/#contacto">{{ t('nav.contact') }}</NuxtLink></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="footer-bottom-copy">
        <p>{{ t('footer.rights') }}</p>
        <p v-if="route.path === '/'" class="footer-dev-credit">TRG1205</p>
      </div>
      <div class="footer-legal">
        <NuxtLink to="/politica-de-privacidad">{{ t('footer.privacyShort') }}</NuxtLink>
        <span>·</span>
        <NuxtLink to="/terminos-y-condiciones">{{ t('footer.termsShort') }}</NuxtLink>
      </div>
      <div class="socials">
        <a :href="platform?.instagramUrl || 'https://www.instagram.com/'" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a :href="platform?.tiktokUrl || 'https://www.tiktok.com/'" target="_blank" rel="noopener noreferrer">TikTok</a>
      </div>
    </div>
  </footer>
</template>
