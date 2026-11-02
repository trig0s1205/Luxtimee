const MAX_EDGE = 2400;
const QUALITY = 0.86;

export async function compressCatalogImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error(`${file.name}: este navegador no puede preparar la foto.`);
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name}: no se pudo leer la foto.`);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const alreadySmall = file.type === 'image/jpeg'
      && longest <= MAX_EDGE
      && file.size > 0
      && file.size <= 2_500_000;
    if (alreadySmall) return file;
    let edge = MAX_EDGE;
    const quality = QUALITY;
    let blob = await renderJpeg(bitmap, edge, quality);
    if (blob.size > 10 * 1024 * 1024) {
      blob = await renderJpeg(bitmap, edge, 0.72);
    }
    if (blob.size > 10 * 1024 * 1024) {
      edge = 1600;
      blob = await renderJpeg(bitmap, edge, 0.72);
    }
    if (blob.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name}: sigue pesando más de 10 MB después de comprimirla.`);
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

function renderJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('No se pudo preparar la foto.'));
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo comprimir la foto.'));
    }, 'image/jpeg', quality);
  });
}
