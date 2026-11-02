export const MAX_PACKAGING_PHOTOS = 24;

export const MAX_PACKAGING_CAPTION = 80;

export interface PackagingPhotoDto {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
}
