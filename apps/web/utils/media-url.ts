function withAssetsBase(path: string, assetsBaseUrl: string): string {
  const base = assetsBaseUrl.replace(/\/$/, '');
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resolveMediaUrl(url?: string | null, assetsBaseUrl = 'http://localhost:3001'): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/uploads')) return withAssetsBase(parsed.pathname, assetsBaseUrl);
    } catch {
      return url;
    }
    return url;
  }
  if (url.startsWith('/uploads')) return withAssetsBase(url, assetsBaseUrl);
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

const CLOUDINARY_VIDEO_TRANSFORM = 'q_auto:good,f_mp4,w_1080,c_limit';

/** Reemplaza transforms existentes en URLs Cloudinary image/upload. */
export function cloudinaryImageUploadWithTransform(url: string, transform: string): string {
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const tail = url.slice(idx + marker.length);
  const segments = tail.split('/');
  const versionIdx = segments.findIndex((s) => /^v\d+$/.test(s));
  let start = 0;
  if (versionIdx >= 0) {
    start = versionIdx;
  } else {
    while (start < segments.length && segments[start].includes(',')) {
      start += 1;
    }
  }
  const publicPath = segments.slice(start).join('/');
  if (!publicPath) return url;
  return `${url.slice(0, idx + marker.length)}${transform}/${publicPath}`;
}

export function optimizeCloudinaryImageUrl(url?: string | null, width = 800): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (url.includes('/f_auto') || url.includes(',f_auto')) return url;
  const transform = `f_auto,q_auto:good,w_${width},c_limit`;
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}

/** Banner inicio: cover 12:5, calidad alta (siempre reescribe transforms). */
export function optimizeCloudinaryHeroBannerUrl(url?: string | null, width = 3840): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  const height = Math.round(width * (5 / 12));
  const transform = `f_auto,q_auto:best,w_${width},h_${height},c_fill,g_center`;
  return cloudinaryImageUploadWithTransform(url, transform);
}

export function optimizeCloudinaryHeroBannerSrcSet(url?: string | null): string | undefined {
  if (!url) return undefined;
  const widths = [1600, 2400, 3200, 3840];
  const parts = widths
    .map((w) => {
      const u = optimizeCloudinaryHeroBannerUrl(url, w);
      return u ? `${u} ${w}w` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export function optimizeCloudinaryHeroWatchUrl(url?: string | null, width = 760): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  const height = Math.round(width * (4 / 3));
  const transform = `f_auto,q_auto:good,w_${width},h_${height},c_fit`;
  if (url.includes('/image/upload/') && /\/image\/upload\/[^/]+\//.test(url)) {
    return url.replace(/\/image\/upload\/[^/]+\//, `/image/upload/${transform}/`);
  }
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}

export function optimizeCloudinaryVideoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return url;
  if (url.includes('/q_auto') || url.includes('/f_mp4')) return url;
  return url.replace('/video/upload/', `/video/upload/${CLOUDINARY_VIDEO_TRANSFORM}/`);
}

export function watchVideoUrl(
  watch: { videoUrl?: string | null },
  assetsBaseUrl?: string,
) {
  return optimizeCloudinaryVideoUrl(resolveMediaUrl(watch.videoUrl, assetsBaseUrl));
}
