import { optimizeCloudinaryImageUrl } from './media-url';

export interface PackagingPhotoLike {
  imageUrl?: string | null;
}

export function visiblePackagingPhotos<T extends PackagingPhotoLike>(
  photos: T[] | null | undefined,
): T[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter(
    (photo) => typeof photo?.imageUrl === 'string' && photo.imageUrl.trim().length > 0,
  );
}

export function packagingImageSrc(url: string, width: number): string {
  return optimizeCloudinaryImageUrl(url, width) ?? url;
}

export function packagingImageSrcSet(url: string, widths: number[]): string | undefined {
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return undefined;
  return widths
    .map((width) => `${packagingImageSrc(url, width)} ${width}w`)
    .join(', ');
}
