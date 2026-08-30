function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type LuxTrailDot = {
  id: number;
  x: number;
  y: number;
  born: number;
  size: number;
};

const TRAIL_LIFE_MS = 880;
const TRAIL_MAX = 28;

const TRAIL_EXCLUDED_PREFIXES = [
  '/checkout',
  '/carrito',
  '/mayoristas/checkout',
  '/mayoristas/carrito',
  '/acceso/',
  '/vigilancia',
  '/admin',
];

export function isLuxCursorTrailRoute(path: string) {
  return !TRAIL_EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function useLuxCursorTrail(enabled: Ref<boolean>) {
  const trail = ref<LuxTrailDot[]>([]);
  const active = ref(false);
  const reducedMotion = ref(false);
  const hasFinePointer = ref(true);

  let frameId: number | null = null;
  let trailId = 0;
  let lastTrailAt = 0;

  function trailDotStyle(dot: LuxTrailDot) {
    const age = performance.now() - dot.born;
    const progress = clamp(age / TRAIL_LIFE_MS, 0, 1);
    const opacity = (1 - progress) * 0.48;

    return {
      left: `${dot.x}px`,
      top: `${dot.y}px`,
      width: `${dot.size}px`,
      height: `${dot.size}px`,
      opacity: String(opacity),
      transform: `translate(-50%, -50%) scale(${1 + progress * 0.75})`,
    };
  }

  function pushTrail(clientX: number, clientY: number) {
    const now = performance.now();
    if (now - lastTrailAt < 22) return;
    lastTrailAt = now;

    trail.value.push({
      id: ++trailId,
      x: clientX,
      y: clientY,
      born: now,
      size: 28 + Math.random() * 22,
    });

    if (trail.value.length > TRAIL_MAX) {
      trail.value.splice(0, trail.value.length - TRAIL_MAX);
    }
  }

  function onPointerMove(event: MouseEvent) {
    if (!enabled.value || reducedMotion.value || !hasFinePointer.value) return;
    active.value = true;
    pushTrail(event.clientX, event.clientY);
  }

  function onPointerLeave() {
    active.value = false;
  }

  function tick() {
    if (enabled.value && !reducedMotion.value) {
      const now = performance.now();
      trail.value = trail.value.filter((dot) => now - dot.born < TRAIL_LIFE_MS);
    } else if (trail.value.length) {
      trail.value = [];
    }

    frameId = requestAnimationFrame(tick);
  }

  function bind() {
    if (!import.meta.client) return;
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
  }

  function unbind() {
    if (!import.meta.client) return;
    window.removeEventListener('mousemove', onPointerMove);
    document.documentElement.removeEventListener('mouseleave', onPointerLeave);
  }

  watch(enabled, (next) => {
    if (!next) trail.value = [];
  });

  onMounted(() => {
    if (!import.meta.client) return;

    reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    hasFinePointer.value = window.matchMedia('(pointer: fine)').matches
      && window.matchMedia('(min-width: 1024px)').matches;

    bind();
    frameId = requestAnimationFrame(tick);
  });

  onBeforeUnmount(() => {
    unbind();
    if (frameId !== null) cancelAnimationFrame(frameId);
  });

  return {
    trail,
    active,
    reducedMotion,
    hasFinePointer,
    trailDotStyle,
  };
}
