export function resolveMediaUrl(url?: string | null, assetsBaseUrl = 'http://localhost:3001'): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/uploads')) return parsed.pathname;
    } catch {
      return url;
    }
    return url;
  }
  if (url.startsWith('/uploads')) return url;
  return `${assetsBaseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

export function watchPrimaryImage(
  watch: {
    frontImageUrl?: string | null;
    primaryImageUrl?: string | null;
    images?: string[];
  },
  assetsBaseUrl?: string,
) {
  return resolveMediaUrl(watch.frontImageUrl || watch.primaryImageUrl || watch.images?.[0], assetsBaseUrl);
}

export function watchSecondaryImage(
  watch: {
    backImageUrl?: string | null;
    secondaryImageUrl?: string | null;
    images?: string[];
  },
  assetsBaseUrl?: string,
) {
  return resolveMediaUrl(watch.backImageUrl || watch.secondaryImageUrl || watch.images?.[1], assetsBaseUrl);
}

export function watchVideoUrl(
  watch: { videoUrl?: string | null },
  assetsBaseUrl?: string,
) {
  return resolveMediaUrl(watch.videoUrl, assetsBaseUrl);
}
