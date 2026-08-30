function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

type TrailDot = {
  id: number;
  x: number;
  y: number;
  born: number;
  size: number;
};

const TRAIL_LIFE_MS = 950;
const TRAIL_MAX = 32;

export function useHeroSpotlightTilt() {
  const heroEl = ref<HTMLElement | null>(null);
  const visualEl = ref<HTMLElement | null>(null);

  const target = ref({ x: 0.5, y: 0.5 });
  const current = ref({ x: 0.5, y: 0.5 });
  const pointerActive = ref(false);
  const reducedMotion = ref(false);
  const trail = ref<TrailDot[]>([]);

  let frameId: number | null = null;
  let trailId = 0;
  let lastTrailAt = 0;

  const tiltStyle = computed(() => {
    if (reducedMotion.value) return {};

    const dx = (current.value.x - 0.5) * 2;
    const dy = (current.value.y - 0.5) * 2;
    const rotateY = dx * 14;
    const rotateX = -dy * 10;
    const lift = pointerActive.value ? 8 : 2;
    const shadowX = -dx * 24;
    const shadowY = 34 + dy * 10;

    return {
      transform: `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${-lift}px)`,
      filter: `drop-shadow(${shadowX}px ${shadowY}px 44px rgba(0, 0, 0, 0.7))`,
    };
  });

  const shineStyle = computed(() => {
    if (reducedMotion.value || !pointerActive.value) return { opacity: '0' };

    const x = current.value.x * 100;
    const y = current.value.y * 100;

    return {
      opacity: '0.55',
      background: `radial-gradient(circle at ${x}% ${y}%, rgba(255, 248, 230, 0.45) 0%, rgba(226, 201, 138, 0.12) 22%, transparent 50%)`,
    };
  });

  const reflectionStyle = computed(() => {
    if (reducedMotion.value) return { opacity: '0' };

    const dx = (current.value.x - 0.5) * 2;
    return {
      opacity: pointerActive.value ? '0.34' : '0.2',
      transform: `translateX(${dx * -10}px) scaleX(${1 - Math.abs(dx) * 0.06})`,
    };
  });

  function trailDotStyle(dot: TrailDot) {
    const age = performance.now() - dot.born;
    const progress = clamp(age / TRAIL_LIFE_MS, 0, 1);
    const opacity = (1 - progress) * 0.62;

    return {
      left: `${dot.x * 100}%`,
      top: `${dot.y * 100}%`,
      width: `${dot.size}px`,
      height: `${dot.size}px`,
      opacity: String(opacity),
      transform: `translate(-50%, -50%) scale(${1 + progress * 0.85})`,
    };
  }

  function pushTrail(x: number, y: number) {
    const now = performance.now();
    if (now - lastTrailAt < 20) return;
    lastTrailAt = now;

    trail.value.push({
      id: ++trailId,
      x,
      y,
      born: now,
      size: 36 + Math.random() * 28,
    });

    if (trail.value.length > TRAIL_MAX) {
      trail.value.splice(0, trail.value.length - TRAIL_MAX);
    }
  }

  function setPointerFromClient(clientX: number, clientY: number) {
    const hero = heroEl.value;
    const visual = visualEl.value;
    if (!hero) return;

    const heroRect = hero.getBoundingClientRect();
    const heroX = clamp((clientX - heroRect.left) / heroRect.width, 0, 1);
    const heroY = clamp((clientY - heroRect.top) / heroRect.height, 0, 1);

    pushTrail(heroX, heroY);

    if (visual) {
      const visualRect = visual.getBoundingClientRect();
      target.value = {
        x: clamp((clientX - visualRect.left) / visualRect.width, 0, 1),
        y: clamp((clientY - visualRect.top) / visualRect.height, 0, 1),
      };
    } else {
      target.value = { x: heroX, y: heroY };
    }

    pointerActive.value = true;
  }

  function onPointerMove(event: MouseEvent) {
    setPointerFromClient(event.clientX, event.clientY);
  }

  function onTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    setPointerFromClient(touch.clientX, touch.clientY);
  }

  function onPointerLeave() {
    pointerActive.value = false;
    target.value = { x: 0.5, y: 0.5 };
  }

  function animate() {
    if (!reducedMotion.value) {
      current.value = {
        x: lerp(current.value.x, target.value.x, pointerActive.value ? 0.16 : 0.08),
        y: lerp(current.value.y, target.value.y, pointerActive.value ? 0.16 : 0.08),
      };

      const now = performance.now();
      trail.value = trail.value.filter((dot) => now - dot.born < TRAIL_LIFE_MS);
    }

    frameId = requestAnimationFrame(animate);
  }

  onMounted(() => {
    if (!import.meta.client) return;
    reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frameId = requestAnimationFrame(animate);
  });

  onBeforeUnmount(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
  });

  return {
    heroEl,
    visualEl,
    pointerActive,
    reducedMotion,
    trail,
    tiltStyle,
    shineStyle,
    reflectionStyle,
    trailDotStyle,
    onPointerMove,
    onTouchMove,
    onPointerLeave,
  };
}
