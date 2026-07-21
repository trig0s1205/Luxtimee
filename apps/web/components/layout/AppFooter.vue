<script setup lang="ts">
const { t } = useLocale();
</script>

<template>
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <p class="brand-name">LUXTIME</p>
        <p class="brand-tagline">Luxury Timepieces</p>
        <p>{{ t('footer.brandText') }}</p>
      </div>

      <div class="footer-col">
        <h4>{{ t('footer.collection') }}</h4>
        <ul>
          <li><NuxtLink to="/catalogo?filter=sport">{{ t('footer.sport') }}</NuxtLink></li>
          <li><NuxtLink to="/catalogo?filter=classic">{{ t('footer.classics') }}</NuxtLink></li>
          <li><NuxtLink to="/catalogo?filter=limited">{{ t('footer.limited') }}</NuxtLink></li>
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
          <li><NuxtLink to="/#nosotros">{{ t('nav.contact') }}</NuxtLink></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p>{{ t('footer.rights') }}</p>
      <div class="footer-legal">
        <NuxtLink to="/politica-de-privacidad">{{ t('footer.privacyShort') }}</NuxtLink>
        <span>·</span>
        <NuxtLink to="/terminos-y-condiciones">{{ t('footer.termsShort') }}</NuxtLink>
      </div>
      <div class="socials">
        <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer">TikTok</a>
        <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer">Facebook</a>
      </div>
    </div>
  </footer>
</template>
