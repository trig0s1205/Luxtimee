import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDocumentTitle } from './utils/seo';

const webRoot = dirname(fileURLToPath(import.meta.url));

function applyEnvDefaults() {
  const file = resolve(webRoot, '.env.defaults');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

applyEnvDefaults();

const apiUpstream = process.env.NUXT_API_UPSTREAM_URL?.replace(/\/$/, '');
const publicApiBase = process.env.NUXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const siteOrigin = process.env.NUXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';

function internalApiUrl(): string {
  if (process.env.NUXT_API_INTERNAL_URL) {
    return process.env.NUXT_API_INTERNAL_URL.replace(/\/$/, '');
  }
  if (apiUpstream) return `${apiUpstream}/api/v1`;
  if (publicApiBase?.startsWith('/') && siteOrigin) return `${siteOrigin}${publicApiBase}`;
  if (publicApiBase) return publicApiBase;
  return 'http://127.0.0.1:3001/api/v1';
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  sourcemap: false,
  experimental: {
    appManifest: false,
  },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: [
    '~/assets/css/tokens.css',
    '~/assets/css/base.css',
    '~/assets/css/dixus-pages.css',
    '~/assets/css/variants.css',
    '~/assets/css/theme-light.css',
    '~/assets/css/storefront-light-fixes.css',
  ],
  routeRules: {
    '/': { swr: false },
    '/catalogo': { swr: false },
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
    apiInternalUrl: internalApiUrl(),
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL
        || (apiUpstream ? '/api/v1' : undefined)
        || (process.env.NUXT_LAN === 'true' ? '/api/v1' : 'http://localhost:3001/api/v1'),
      apiUploadUrl: process.env.NUXT_PUBLIC_API_UPLOAD_URL
        || (apiUpstream ? `${apiUpstream}/api/v1` : undefined)
        || process.env.NUXT_PUBLIC_API_BASE_URL
        || (process.env.NUXT_LAN === 'true' ? '/api/v1' : 'http://localhost:3001/api/v1'),
      apiAssetsUrl: process.env.NUXT_PUBLIC_API_ASSETS_URL
        ?? (apiUpstream || process.env.NUXT_LAN === 'true' ? '' : 'http://localhost:3001'),
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      staffLoginSlug: process.env.NUXT_PUBLIC_STAFF_LOGIN_SLUG || '',
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
  hooks: {
    'pages:extend'(pages) {
      const patchAdminTransitions = (routePages: typeof pages) => {
        for (const page of routePages) {
          const file = page.file ?? '';
          if (file.includes('/pages/admin/') || file.includes('/pages/mayoristas/')) {
            page.meta = {
              ...page.meta,
              pageTransition: false,
              layoutTransition: false,
            };
          }
          if (page.children?.length) patchAdminTransitions(page.children);
        }
      };
      patchAdminTransitions(pages);
    },
    'build:manifest'(manifest) {
      const markers = [
        'layouts/admin',
        'pages/admin',
        'components/admin',
        'middleware/admin',
        'apexcharts',
        'vue3-apexcharts',
        'watch-bulk-draft',
        'zip-entries',
        'admin-warmup',
        'admin-cache',
        'stores/admin',
        'composables/useAdmin',
      ];
      const isAdminBundle = (value: string) => markers.some((marker) => value.includes(marker));
      for (const [key, chunk] of Object.entries(manifest)) {
        const id = `${key} ${chunk.src ?? ''} ${chunk.file ?? ''} ${chunk.name ?? ''}`;
        if (chunk.isEntry && chunk.dynamicImports) {
          chunk.dynamicImports = chunk.dynamicImports.filter((item) => !isAdminBundle(item));
        }
        if (!chunk.isEntry && isAdminBundle(id)) {
          chunk.prefetch = false;
          chunk.preload = false;
        }
      }
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
    pageTransition: { name: 'lux-page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'es-CO', 'data-theme': 'light' },
      title: 'LUXTIMEE — Relojes de lujo',
      titleTemplate: formatDocumentTitle as unknown as string,
      script: [
        {
          key: 'luxtimee-theme-boot',
          innerHTML:
            "(function(){try{document.documentElement.setAttribute('data-theme','light');localStorage.removeItem('luxtimee-theme');}catch(e){}})();",
          tagPosition: 'head',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://res.cloudinary.com' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Montserrat:wght@200;300;400;600&display=swap',
        },
      ],
    },
  },
});
