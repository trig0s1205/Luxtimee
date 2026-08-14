import { fileURLToPath } from 'node:url';

const apiUpstream = process.env.NUXT_API_UPSTREAM_URL?.replace(/\/$/, '');

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/dixus-pages.css', '~/assets/css/variants.css', '~/assets/css/theme-light.css'],
  routeRules: {
    '/': { swr: 60 },
    '/catalogo': { swr: 120 },
    '/admin/**': { ssr: false },
    ...(apiUpstream
      ? {
          '/api/v1/**': { proxy: `${apiUpstream}/api/v1/**` },
          '/uploads/**': { proxy: `${apiUpstream}/uploads/**` },
        }
      : {}),
  },
  alias: {
    '@luxtime/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    apiInternalUrl: process.env.NUXT_API_INTERNAL_URL
      || (apiUpstream ? `${apiUpstream}/api/v1` : undefined)
      || process.env.NUXT_PUBLIC_API_BASE_URL
      || 'http://127.0.0.1:3001/api/v1',
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL
        || (apiUpstream ? '/api/v1' : undefined)
        || (process.env.NUXT_LAN === 'true' ? '/api/v1' : 'http://localhost:3001/api/v1'),
      apiAssetsUrl: process.env.NUXT_PUBLIC_API_ASSETS_URL
        ?? (process.env.NUXT_LAN === 'true' ? '' : 'http://localhost:3001'),
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      staffLoginSlug: process.env.NUXT_PUBLIC_STAFF_LOGIN_SLUG || 'dev-portal-lx9k2',
      ga4MeasurementId: process.env.NUXT_PUBLIC_GA4_MEASUREMENT_ID || '',
      googleSiteVerification: process.env.NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    },
  },
  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.WEB_PORT || 3000),
  },
  vite: {
    server: {
      allowedHosts: process.env.NUXT_LAN === 'true' ? true : undefined,
      hmr: process.env.NUXT_LAN === 'true' ? { clientPort: 24679 } : undefined,
    },
  },
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://127.0.0.1:3001/api',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001/uploads',
        changeOrigin: true,
      },
    },
  },
  app: {
    head: {
      title: 'LuxTimee — Luxury Watches',
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
