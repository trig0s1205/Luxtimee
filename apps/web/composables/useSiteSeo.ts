import {
  BRAND,
  CANONICAL_ORIGIN,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_PATH,
  absoluteAssetUrl,
  breadcrumbJsonLd,
  canonicalPath,
  canonicalUrl,
  formatDocumentTitle,
  isNoIndexPath,
  jsonLdGraph,
  localBusinessJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  shouldEmitCanonical,
  splitSameAs,
  staticPageSeo,
  websiteJsonLd,
  type Breadcrumb,
} from '~/utils/seo';

export type PageSeoOverride = {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  ogType?: 'website' | 'product';
  noindex?: boolean;
  breadcrumbs?: Breadcrumb[];
  jsonLd?: Record<string, unknown>[];
};

export function usePageSeo(input: MaybeRefOrGetter<PageSeoOverride>) {
  const route = useRoute();
  const bag = useState<Record<string, PageSeoOverride>>('luxtimee-page-seo', () => ({}));
  watch(() => ({ path: route.path, value: toValue(input) }), ({ path, value }) => {
    bag.value = { ...bag.value, [path]: value };
  }, { immediate: true, deep: true });
}

function isPrivateShell(path: string) {
  return path.startsWith('/acceso') || path.startsWith('/vigilancia') || path.startsWith('/admin');
}

function privateDocumentTitle(path: string) {
  if (path.startsWith('/admin')) return 'Administración — LUXTIMEE';
  if (path.startsWith('/vigilancia')) return 'Acceso restringido — LUXTIMEE';
  if (path.startsWith('/acceso')) return 'Acceso — LUXTIMEE';
  return undefined;
}

export function useSiteSeo() {
  const route = useRoute();
  const config = useRuntimeConfig();
  const bag = useState<Record<string, PageSeoOverride>>('luxtimee-page-seo', () => ({}));
  const business = localBusinessJsonLd({
    phone: String(config.public.businessPhone || ''),
    whatsapp: String(config.public.businessWhatsapp || ''),
    openingHours: String(config.public.businessOpeningHours || ''),
    sameAs: splitSameAs(String(config.public.businessSameAs || '')),
  });

  const resolved = computed(() => {
    const path = route.path;
    const override = bag.value[path] ?? {};
    const fallback = staticPageSeo(path);
    const titleSource = override.title || fallback?.title;
    const description = override.description || fallback?.description || (titleSource ? DEFAULT_DESCRIPTION : '');
    const image = absoluteAssetUrl(override.image || DEFAULT_OG_IMAGE_PATH);
    const imageIsDefault = !override.image;
    const noindex = override.noindex ?? isNoIndexPath(path);
    const breadcrumbs = override.breadcrumbs ?? fallback?.breadcrumbs ?? [];
    const nodes: Record<string, unknown>[] = [organizationJsonLd(), websiteJsonLd(), business];
    if (breadcrumbs.length > 1) nodes.push(breadcrumbJsonLd(breadcrumbs));
    if (override.jsonLd?.length) nodes.push(...override.jsonLd);
    return {
      title: titleSource ? formatDocumentTitle(titleSource) : undefined,
      description: description || undefined,
      canonical: shouldEmitCanonical(path) ? canonicalUrl(path) : undefined,
      image,
      imageAlt: override.imageAlt || (imageIsDefault ? DEFAULT_OG_IMAGE_ALT : titleSource || BRAND),
      imageIsDefault,
      ogType: override.ogType || 'website',
      robots: noindex ? 'noindex, nofollow' : 'index, follow',
      jsonLd: jsonLdGraph(nodes),
    };
  });

  useHead(() => {
    const path = canonicalPath(route.path);
    const fallback = privateDocumentTitle(path);
    if (!isPrivateShell(path) || !fallback) return {};
    return { title: fallback };
  }, { tagPriority: 100 });

  useHead(() => {
    const path = canonicalPath(route.path);
    if (isPrivateShell(path)) {
      return {
        meta: [{ name: 'robots', key: 'robots', content: 'noindex, nofollow' }],
      };
    }
    const seo = resolved.value;
    const meta: Array<Record<string, string>> = [
      { property: 'og:site_name', content: BRAND },
      { property: 'og:locale', content: 'es_CO' },
      { property: 'og:type', content: seo.ogType },
      { property: 'og:image', content: seo.image },
      { property: 'og:image:alt', content: seo.imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: seo.image },
      { name: 'robots', key: 'robots', content: seo.robots },
    ];
    if (seo.imageIsDefault) {
      meta.push(
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
      );
    }
    if (seo.description) {
      meta.push(
        { name: 'description', content: seo.description },
        { property: 'og:description', content: seo.description },
        { name: 'twitter:description', content: seo.description },
      );
    }
    if (seo.title) {
      meta.push(
        { property: 'og:title', content: seo.title },
        { name: 'twitter:title', content: seo.title },
      );
    }
    if (seo.canonical) {
      meta.push({ property: 'og:url', content: seo.canonical });
    }
    return {
      title: seo.title,
      meta,
      link: seo.canonical ? [{ rel: 'canonical', href: seo.canonical, key: 'canonical' }] : [],
      script: [{
        type: 'application/ld+json',
        key: 'ld-site',
        innerHTML: serializeJsonLd(seo.jsonLd),
      }],
    };
  });

  return { canonicalOrigin: CANONICAL_ORIGIN };
}
