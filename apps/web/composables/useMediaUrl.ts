import { resolveMediaUrl, watchPrimaryImage, watchSecondaryImage } from '~/utils/media-url';

export function useMediaUrl() {
  const config = useRuntimeConfig();
  const assetsBaseUrl = config.public.apiAssetsUrl as string;

  return {
    resolve: (url?: string | null) => resolveMediaUrl(url, assetsBaseUrl),
    watchPrimaryImage: (watch: Parameters<typeof watchPrimaryImage>[0]) =>
      watchPrimaryImage(watch, assetsBaseUrl),
    watchSecondaryImage: (watch: Parameters<typeof watchSecondaryImage>[0]) =>
      watchSecondaryImage(watch, assetsBaseUrl),
  };
}
