const RESUME_DELAY = 2200;

export function useInfiniteHorizontalScroll(options: {
  cycleSeconds: Ref<number> | number;
  enabled?: Ref<boolean> | boolean;
}) {
  const viewport = ref<HTMLElement | null>(null);
  const track = ref<HTMLElement | null>(null);

  let frameId: number | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFrame = 0;
  let offset = 0;
  let paused = false;

  function cycleSecondsValue() {
    return toValue(options.cycleSeconds);
  }

  function isEnabled() {
    return toValue(options.enabled ?? true);
  }

  function loopWidth() {
    return track.value ? track.value.scrollWidth / 2 : 0;
  }

  function normalizeScroll() {
    const el = viewport.value;
    const width = loopWidth();
    if (!el || width <= 0) return;

    if (el.scrollLeft >= width) el.scrollLeft -= width;
    else if (el.scrollLeft < 0) el.scrollLeft += width;
    offset = el.scrollLeft;
  }

  function scrollSpeed() {
    const width = loopWidth();
    return width > 0 ? width / cycleSecondsValue() : 0;
  }

  function step(timestamp: number) {
    const el = viewport.value;
    if (!el || !isEnabled()) {
      frameId = requestAnimationFrame(step);
      return;
    }

    const delta = lastFrame ? (timestamp - lastFrame) / 1000 : 0;
    lastFrame = timestamp;

    if (!paused && delta > 0) {
      offset += scrollSpeed() * delta;
      const width = loopWidth();
      if (width > 0) {
        if (offset >= width) offset -= width;
        el.scrollLeft = offset;
        if (el.scrollLeft >= width) {
          el.scrollLeft -= width;
          offset = el.scrollLeft;
        }
      }
    }

    frameId = requestAnimationFrame(step);
  }

  function startAutoScroll() {
    if (frameId !== null || !import.meta.client) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lastFrame = 0;
    frameId = requestAnimationFrame(step);
  }

  function stopAutoScroll() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function pause() {
    paused = true;
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function resume() {
    normalizeScroll();
    paused = false;
    lastFrame = 0;
  }

  function pauseTemporarily() {
    pause();
    resumeTimer = setTimeout(resume, RESUME_DELAY);
  }

  function onTouchEnd() {
    pauseTemporarily();
  }

  function scrollByCards(direction: -1 | 1) {
    const el = viewport.value;
    if (!el) return;

    pause();
    normalizeScroll();
    el.scrollBy({ left: direction * el.clientWidth * 0.55, behavior: 'smooth' });
  }

  function onManualScroll() {
    if (!paused) return;
    offset = viewport.value?.scrollLeft ?? offset;
  }

  function resetCarousel() {
    const el = viewport.value;
    if (!el) return;
    offset = 0;
    el.scrollLeft = 0;
  }

  function initCarousel() {
    stopAutoScroll();
    nextTick(() => {
      requestAnimationFrame(() => {
        if (loopWidth() <= 0) return;
        resetCarousel();
        paused = false;
        startAutoScroll();
      });
    });
  }

  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    initCarousel();
    if (viewport.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        normalizeScroll();
        if (loopWidth() > 0 && frameId === null) initCarousel();
      });
      resizeObserver.observe(viewport.value);
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    stopAutoScroll();
  });

  return {
    viewport,
    track,
    initCarousel,
    pause,
    resume,
    pauseTemporarily,
    onTouchEnd,
    scrollByCards,
    onManualScroll,
  };
}
