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
  { fromX: -55, fromY: -40, toX: -38, toY: -8, rotate: -22, scale: 0.52, blur: 1.5 },
  { fromX: 58, fromY: 42, toX: 42, toY: 28, rotate: 16, scale: 0.48, blur: 2 },
  { fromX: 52, fromY: -38, toX: 36, toY: -12, rotate: 11, scale: 0.5, blur: 1.5 },
  { fromX: -48, fromY: 38, toX: -34, toY: 22, rotate: -14, scale: 0.46, blur: 2.5 },
  { fromX: 44, fromY: 18, toX: 48, toY: 14, rotate: 7, scale: 0.44, blur: 3 },
  { fromX: -42, fromY: 8, toX: -28, toY: 6, rotate: -18, scale: 0.47, blur: 2 },
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

export function useHeroScrollytelling(itemCount: Ref<number>, scrollEnabled: Ref<boolean>) {
  const heroRoot = ref<HTMLElement | null>(null);
  const scrollProgress = ref(0);
  const isPinned = ref(false);
  const reducedMotion = ref(false);
  const isMobile = ref(false);

  const scrollHeightVh = computed(() => {
    const count = Math.max(itemCount.value, 1);
    if (!scrollEnabled.value || reducedMotion.value) return 100;
    const perItem = isMobile.value ? 32 : 45;
    return 100 + count * perItem;
  });

  const activeIndexFromScroll = computed(() => {
    const count = itemCount.value;
    if (count <= 1) return 0;
    return clamp(Math.floor(scrollProgress.value * count), 0, count - 1);
  });

  function updateProgress() {
    const el = heroRoot.value;
    if (!el || !scrollEnabled.value || reducedMotion.value) {
      scrollProgress.value = 0;
      isPinned.value = false;
      return;
    }

    const rect = el.getBoundingClientRect();
    const trackHeight = el.offsetHeight;
    const scrollable = trackHeight - window.innerHeight;

    if (scrollable <= 8) {
      scrollProgress.value = 0;
      isPinned.value = false;
      return;
    }

    if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
      isPinned.value = true;
      scrollProgress.value = clamp(-rect.top / scrollable, 0, 1);
      return;
    }

    isPinned.value = false;
    scrollProgress.value = rect.top > 0 ? 0 : 1;
  }

  function floatStyle(index: number, isActive: boolean) {
    if (reducedMotion.value || !scrollEnabled.value) {
      return { opacity: '0', pointerEvents: 'none' as const };
    }

    const count = Math.max(itemCount.value, 1);
    const segment = 1 / Math.max(count, 2);
    const start = Math.max(0, index * segment - segment * 0.15);
    const end = start + segment * 1.35;
    const raw = clamp((scrollProgress.value - start) / Math.max(end - start, 0.001), 0, 1);
    const t = easeOutCubic(raw);

    const path = FLOAT_PATHS[index % FLOAT_PATHS.length];
    const x = lerp(path.fromX, path.toX, t);
    const y = lerp(path.fromY, path.toY, t);
    const rotate = lerp(path.rotate - 18, path.rotate, t);
    const scale = lerp(path.scale * 0.65, path.scale, t);
    const opacity = isActive
      ? lerp(0, 0.35, t)
      : lerp(0, 0.88, t);
    const blur = lerp(path.blur + 4, path.blur, t);

    return {
      transform: `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh)) rotate(${rotate}deg) scale(${scale})`,
      opacity: String(opacity),
      filter: `blur(${blur}px)`,
      zIndex: String(Math.round(t * 10)),
    };
  }

  function glowStyle() {
    if (reducedMotion.value || !scrollEnabled.value) return {};
    const drift = scrollProgress.value;
    if (drift <= 0.001) return {};
    return {
      opacity: String(lerp(1, 0.6, drift)),
      transform: `scale(${1 + drift * 0.18}) translate(${drift * 8 - 4}%, ${drift * -6}%)`,
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

  watch([itemCount, scrollEnabled], () => nextTick(updateProgress));

  return {
    heroRoot,
    scrollProgress,
    scrollHeightVh,
    activeIndexFromScroll,
    reducedMotion,
    isPinned,
    floatStyle,
    glowStyle,
    updateProgress,
  };
}
