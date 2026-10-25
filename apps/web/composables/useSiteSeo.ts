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
  organizationJsonLd,
  serializeJsonLd,
  shouldEmitCanonical,
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

export function useSiteSeo() {
  const route = useRoute();
  const bag = useState<Record<string, PageSeoOverride>>('luxtimee-page-seo', () => ({}));

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
    const nodes: Record<string, unknown>[] = [organizationJsonLd(), websiteJsonLd()];
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
    if (path.startsWith('/acceso') || path.startsWith('/vigilancia') || path.startsWith('/admin')) return {};
    const seo = resolved.value;
    const meta: Array<Record<string, string>> = [
      { property: 'og:site_name', content: BRAND },
      { property: 'og:locale', content: 'es_CO' },
      { property: 'og:type', content: seo.ogType },
      { property: 'og:image', content: seo.image },
      { property: 'og:image:alt', content: seo.imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: seo.image },
      { name: 'robots', content: seo.robots },
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
