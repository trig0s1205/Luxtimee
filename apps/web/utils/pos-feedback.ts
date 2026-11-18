type BeepKind = 'ok' | 'error';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  durationMs: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000);
}

export function playBeep(kind: BeepKind) {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('luxtimee.pos.sound');
      if (stored === '0' || stored === 'false') return;
    }
    const ctx = getCtx();
    if (!ctx) return;
    void ctx.resume();
    const now = ctx.currentTime;
    if (kind === 'ok') {
      tone(ctx, 880, now, 90);
      return;
    }
    tone(ctx, 220, now, 120);
    tone(ctx, 220, now + 0.2, 120);
  } catch {
    /* never throw */
  }
}
