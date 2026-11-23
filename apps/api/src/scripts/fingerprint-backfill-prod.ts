const CLOUDINARY_HOST = 'res.cloudinary.com';

export function isAllowedCloudinaryImageUrl(
  imageUrl: string,
  cloudName?: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === CLOUDINARY_HOST) return true;
  const cloud = cloudName?.trim().toLowerCase();
  if (!cloud || !cloud.includes('.')) return false;
  return host === cloud || host.endsWith(`.${cloud}`);
}

export function assertProductionApplyAllowed(
  apply: boolean,
  confirm: string | undefined,
): void {
  if (!apply) return;
  if (confirm !== 'SI') {
    throw new Error(
      'Falta CONFIRM_PROD_FINGERPRINTS=SI. Sin esa variable no se escribe nada en producción.',
    );
  }
}

type CloudinaryFetch = (
  imageUrl: string,
  init: { redirect: 'follow'; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  if (error instanceof TypeError) return true;
  return /^HTTP 5/.test(error.message);
}

export async function downloadCloudinaryImage(
  imageUrl: string,
  cloudName: string | undefined,
  fetchImpl: CloudinaryFetch = fetch as unknown as CloudinaryFetch,
): Promise<Uint8Array> {
  if (!isAllowedCloudinaryImageUrl(imageUrl, cloudName)) {
    throw new Error('url fuera de Cloudinary');
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(imageUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!isAllowedCloudinaryImageUrl(response.url || imageUrl, cloudName)) {
        throw new Error('la respuesta no quedó en Cloudinary');
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('error de red');
}
