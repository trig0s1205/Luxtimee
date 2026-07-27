import { fileURLToPath } from 'node:url';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/dixus-pages.css', '~/assets/css/admin-dashboard.css', '~/assets/css/admin-tables.css', '~/assets/css/variants.css'],
  alias: {
    '@luxtime/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1',
      apiAssetsUrl: process.env.NUXT_PUBLIC_API_ASSETS_URL || 'http://localhost:3001',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
  nitro: {
    devProxy: {
      '/uploads': {
        target: 'http://localhost:3001/uploads',
        changeOrigin: true,
      },
    },
  },
  app: {
    head: {
      title: 'Luxtime — Luxury Watches',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Montserrat:wght@200;300;400;600&display=swap',
        },
      ],
    },
  },
});
