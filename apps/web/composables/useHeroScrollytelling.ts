type FloatPath = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  rotate: number;
  scale: number;
  blur: number;
};

const FLOAT_PATHS: FloatPath[] = [
  { fromX: -115, fromY: -75, toX: 12, toY: 18, rotate: -22, scale: 0.42, blur: 2 },
  { fromX: 125, fromY: 88, toX: 88, toY: 72, rotate: 16, scale: 0.38, blur: 3 },
  { fromX: 108, fromY: -65, toX: 82, toY: 12, rotate: 11, scale: 0.4, blur: 2.5 },
  { fromX: -95, fromY: 82, toX: 6, toY: 68, rotate: -14, scale: 0.36, blur: 3.5 },
  { fromX: 92, fromY: 48, toX: 94, toY: 42, rotate: 7, scale: 0.34, blur: 4 },
  { fromX: -88, fromY: 28, toX: 4, toY: 38, rotate: -18, scale: 0.37, blur: 3 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function useHeroScrollytelling(itemCount: Ref<number>) {
  const heroRoot = ref<HTMLElement | null>(null);
  const scrollProgress = ref(0);
  const reducedMotion = ref(false);
  const isMobile = ref(false);

  const scrollHeightVh = computed(() => {
    const count = Math.max(itemCount.value, 1);
    if (reducedMotion.value) return 100;
    const perItem = isMobile.value ? 26 : 38;
    return 100 + count * perItem;
  });

  const activeIndexFromScroll = computed(() => {
    const count = itemCount.value;
    if (count <= 1) return 0;
    return clamp(Math.floor(scrollProgress.value * count), 0, count - 1);
  });

  function updateProgress() {
    const el = heroRoot.value;
    if (!el || reducedMotion.value) {
      scrollProgress.value = 0;
      return;
    }

    const rect = el.getBoundingClientRect();
    const scrollable = el.offsetHeight - window.innerHeight;
    if (scrollable <= 0) {
      scrollProgress.value = 0;
      return;
    }

    const scrolled = clamp(-rect.top, 0, scrollable);
    scrollProgress.value = scrolled / scrollable;
  }

  function floatStyle(index: number, isActive: boolean) {
    if (isActive || reducedMotion.value) {
      return { opacity: '0', pointerEvents: 'none' as const };
    }

    const count = Math.max(itemCount.value, 1);
    const segment = 1 / (count + 0.5);
    const start = index * segment * 0.85;
    const end = start + segment * 1.15;
    const raw = clamp((scrollProgress.value - start) / (end - start), 0, 1);
    const t = easeOutCubic(raw);

    const path = FLOAT_PATHS[index % FLOAT_PATHS.length];
    const x = lerp(path.fromX, path.toX, t);
    const y = lerp(path.fromY, path.toY, t);
    const rotate = lerp(path.rotate - 28, path.rotate, t);
    const scale = lerp(path.scale * 0.55, path.scale, t);
    const opacity = lerp(0, 0.72, t);
    const blur = lerp(path.blur + 6, path.blur, t);

    return {
      transform: `translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${scale})`,
      opacity: String(opacity),
      filter: `blur(${blur}px)`,
      zIndex: String(Math.round(t * 10)),
    };
  }

  function glowStyle() {
    if (reducedMotion.value) return {};
    const drift = scrollProgress.value;
    return {
      transform: `scale(${1 + drift * 0.12}) translate(${drift * 6 - 3}%, ${drift * -4}%)`,
      opacity: String(lerp(1, 0.55, drift)),
    };
  }

  onMounted(() => {
    if (!import.meta.client) return;
    reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isMobile.value = window.matchMedia('(max-width: 768px)').matches;
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
  });

  onBeforeUnmount(() => {
    if (!import.meta.client) return;
    window.removeEventListener('scroll', updateProgress);
    window.removeEventListener('resize', updateProgress);
  });

  watch(itemCount, () => nextTick(updateProgress));

  return {
    heroRoot,
    scrollProgress,
    scrollHeightVh,
    activeIndexFromScroll,
    reducedMotion,
    floatStyle,
    glowStyle,
    updateProgress,
  };
}
