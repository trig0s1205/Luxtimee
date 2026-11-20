/** Backoff suave: al fallar duplica hasta 60s; al recuperar vuelve al intervalo base. */
export function nextLiveRefreshDelay(
  baseMs: number,
  previousMs: number,
  failed: boolean,
  maxMs = 60_000,
): number {
  if (!failed) return Math.max(0, baseMs);
  if (baseMs <= 0) return 0;
  const doubled = Math.max(baseMs, previousMs) * 2;
  return Math.min(maxMs, doubled);
}

export function shouldRunLiveRefresh(input: {
  visible: boolean;
  paused: boolean;
  enabled: boolean;
  inflight: boolean;
}): boolean {
  return input.visible && !input.paused && input.enabled && !input.inflight;
}
