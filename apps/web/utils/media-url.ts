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
