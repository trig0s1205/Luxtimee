import type { WatchStaffDto } from '@luxtime/shared';
import { WatchStatus } from '@luxtime/shared';
import { extractApiErrorMessage, isBadRequest } from '~/utils/api-error';
import { validateWatchVideoFile } from '~/utils/video-validation';

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
  videoUrl?: string;
  primaryImageFile?: File | null;
  secondaryImageFile?: File | null;
  videoFile?: File | null;
};

export function useAdminWatchEditSubmit() {
  const api = useApi();
  const toast = useToast();
  const auth = useAuthStore();
  const mediaQueue = useMediaUploadStore();

  async function saveWatchEdit(
    editingWatch: WatchStaffDto,
    form: AdminWatchFormPayload,
    brands: { id: string; name: string }[],
  ): Promise<boolean> {
    const hasNewPrimaryImage = !!form.primaryImageFile;
    const hasNewSecondaryImage = !!form.secondaryImageFile;
    const hasVideo = !!form.videoFile;
    const hasNewMedia = hasNewPrimaryImage || hasNewSecondaryImage || hasVideo;

    if (form.videoFile) {
      const videoError = await validateWatchVideoFile(form.videoFile);
      if (videoError) {
        toast.warning(videoError);
        return false;
      }
    }

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

    if (auth.isSuperAdmin && form.cost !== undefined) {
      payload.cost = Number(form.cost);
    }

    const watchId = editingWatch.id;
    const brandName = brands.find((b) => b.id === form.brandId)?.name ?? editingWatch.brand?.name ?? '';

    try {
      await api.patch<WatchStaffDto>(`/watches/${watchId}`, payload);
      toast.success(hasNewMedia ? 'Reloj actualizado — multimedia en proceso...' : 'Reloj actualizado correctamente');

      if (hasNewMedia) {
        mediaQueue.enqueue({
          watchId,
          model: form.model || editingWatch.model,
          brandName,
          files: {
            ...(form.primaryImageFile ? { image1: form.primaryImageFile } : {}),
            ...(form.secondaryImageFile ? { image2: form.secondaryImageFile } : {}),
            ...(hasVideo ? { video: form.videoFile! } : {}),
          },
        });
      }
      return true;
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Error al guardar el reloj');
      if (isBadRequest(err)) toast.warning(message);
      else toast.error(message);
      return false;
    }
  }

  return { saveWatchEdit };
}
