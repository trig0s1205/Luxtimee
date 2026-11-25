import type { WatchStaffDto, WatchStatus } from '@luxtime/shared';
import { extractApiErrorMessage, isBadRequest } from '~/utils/api-error';
import { invalidateStorefrontCatalogCaches } from '~/utils/storefront-cache';

export type AdminWatchFormPayload = {
  brandId: string;
  categoryId?: string;
  mechanismId?: string;
  movementType?: string;
  model: string;
  description?: string;
  gender?: string;
  warrantyMonths: number;
  careTemplateId?: string;
  retailPrice: number;
  wholesalePrice: number;
  cost?: number;
  stock: number;
  status: WatchStatus;
  isLimitedEdition: boolean;
  limitedEditionNumber?: string;
  images: string[];
  mainImageIndex: number;
  primaryImageUrl?: string;
  secondaryImageUrl?: string;
  primaryImageFile?: File | null;
  secondaryImageFile?: File | null;
};

export function useAdminWatchEditSubmit() {
  const api = useApi();
  const toast = useToast();
  const mediaQueue = useMediaUploadStore();

  async function saveWatchEdit(
    editingWatch: WatchStaffDto,
    form: AdminWatchFormPayload,
    brands: { id: string; name: string }[],
  ): Promise<{ ok: boolean; publishedNow?: boolean }> {
    const hasNewPrimaryImage = !!form.primaryImageFile;
    const hasNewSecondaryImage = !!form.secondaryImageFile;
    const hasNewMedia = hasNewPrimaryImage || hasNewSecondaryImage;

    const wasUnpublished = !editingWatch.isPublished;

    const payload: Record<string, unknown> = {
      brandId: form.brandId,
      categoryId: form.categoryId || undefined,
      mechanismId: form.mechanismId || undefined,
      movementType: form.movementType || undefined,
      model: form.model,
      description: form.description,
      gender: form.gender,
      warrantyMonths: Number(form.warrantyMonths),
      retailPrice: Number(form.retailPrice),
      wholesalePrice: Number(form.wholesalePrice),
      stock: Number(form.stock),
      status: form.status,
      isLimitedEdition: form.isLimitedEdition,
      limitedEditionNumber: form.limitedEditionNumber,
      images: form.images,
      mainImageIndex: form.mainImageIndex,
      careTemplateId: form.careTemplateId || '',
    };

    const originalPrimary = editingWatch.primaryImageUrl || editingWatch.frontImageUrl || editingWatch.images?.[0];
    const originalSecondary = editingWatch.secondaryImageUrl || editingWatch.backImageUrl || editingWatch.images?.[1];
    if (!hasNewPrimaryImage && form.primaryImageUrl && form.primaryImageUrl !== originalPrimary) {
      payload.primaryImageUrl = form.primaryImageUrl;
    }
    if (!hasNewSecondaryImage && form.secondaryImageUrl && form.secondaryImageUrl !== originalSecondary) {
      payload.secondaryImageUrl = form.secondaryImageUrl;
    }

    if (form.cost !== undefined) {
      payload.cost = Number(form.cost);
    }

    const watchId = editingWatch.id;
    const brandName = brands.find((b) => b.id === form.brandId)?.name ?? editingWatch.brand?.name ?? '';

    try {
      const updated = await api.patch<WatchStaffDto>(`/watches/${watchId}`, payload);
      const publishedNow = wasUnpublished && updated.isPublished;
      toast.success(
        publishedNow
          ? 'Reloj completo — ya está publicado en el catálogo.'
          : hasNewMedia
            ? 'Reloj actualizado — multimedia en proceso...'
            : 'Reloj actualizado correctamente',
      );

      invalidateStorefrontCatalogCaches();

      if (hasNewMedia) {
        mediaQueue.enqueue({
          watchId,
          model: form.model || editingWatch.model,
          brandName,
          files: {
            ...(form.primaryImageFile ? { image1: form.primaryImageFile } : {}),
            ...(form.secondaryImageFile ? { image2: form.secondaryImageFile } : {}),
          },
        });
      }
      return { ok: true, publishedNow };
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Error al guardar el reloj');
      if (isBadRequest(err)) toast.warning(message);
      else toast.error(message);
      return { ok: false };
    }
  }

  return { saveWatchEdit };
}
