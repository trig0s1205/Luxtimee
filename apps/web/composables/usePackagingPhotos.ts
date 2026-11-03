import type { PackagingPhotoDto } from '@luxtime/shared';
import { API_TIMEOUT_MS } from '~/utils/api-timeout';
import { visiblePackagingPhotos } from '~/utils/packaging-gallery';

export const PACKAGING_PHOTOS_KEY = 'packaging-photos-v1';

export function usePackagingPhotos() {
  const baseUrl = useApiBaseUrl();

  async function fetchPhotos(): Promise<PackagingPhotoDto[]> {
    try {
      const rows = await $fetch<PackagingPhotoDto[]>(
        `${baseUrl}/settings/packaging/public`,
        { timeout: API_TIMEOUT_MS },
      );
      return visiblePackagingPhotos(rows);
    } catch {
      return [];
    }
  }

  return { fetchPhotos };
}
