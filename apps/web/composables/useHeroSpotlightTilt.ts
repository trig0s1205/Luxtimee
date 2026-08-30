function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export function useHeroSpotlightTilt() {
  const heroEl = ref<HTMLElement | null>(null);
  const visualEl = ref<HTMLElement | null>(null);

  const target = ref({ x: 0.62, y: 0.48 });
  const current = ref({ x: 0.62, y: 0.48 });
  const pointer = ref({ x: 0.62, y: 0.48 });
  const pointerActive = ref(false);
  const reducedMotion = ref(false);

  let frameId: number | null = null;
  let driftPhase = 0;

  const spotlightVars = computed(() => {
    const x = current.value.x * 100;
    const y = current.value.y * 100;
    const px = pointer.value.x * 100;
    const py = pointer.value.y * 100;
    const boost = pointerActive.value ? 1 : 0.72;

    return {
      '--spot-x': `${x}%`,
      '--spot-y': `${y}%`,
      '--ptr-x': `${px}%`,
      '--ptr-y': `${py}%`,
      '--spot-boost': String(boost),
    } as Record<string, string>;
  });

  const tiltStyle = computed(() => {
    if (reducedMotion.value) return {};

    const dx = (current.value.x - 0.5) * 2;
    const dy = (current.value.y - 0.5) * 2;
    const rotateY = dx * 16;
    const rotateX = -dy * 11;
    const lift = pointerActive.value ? 10 : 4;
    const shadowX = -dx * 28;
    const shadowY = 36 + dy * 12;

    return {
      transform: `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${-lift}px) scale(1)`,
      filter: `drop-shadow(${shadowX}px ${shadowY}px 48px rgba(0, 0, 0, 0.72))`,
    };
  });

  const shineStyle = computed(() => {
    if (reducedMotion.value) return { opacity: '0' };

    const x = current.value.x * 100;
    const y = current.value.y * 100;
    const strength = pointerActive.value ? 0.82 : 0.45;

    return {
      opacity: String(strength),
      background: `radial-gradient(circle at ${x}% ${y}%, rgba(255, 248, 230, 0.55) 0%, rgba(226, 201, 138, 0.18) 18%, transparent 52%)`,
    };
  });

  const reflectionStyle = computed(() => {
    if (reducedMotion.value) return { opacity: '0' };

    const dx = (current.value.x - 0.5) * 2;
    return {
      opacity: pointerActive.value ? '0.42' : '0.28',
      transform: `translateX(${dx * -12}px) scaleX(${1 - Math.abs(dx) * 0.08})`,
    };
  });

  function setPointerFromClient(clientX: number, clientY: number) {
    const hero = heroEl.value;
    const visual = visualEl.value;
    if (!hero) return;

    const heroRect = hero.getBoundingClientRect();
    pointer.value = {
      x: clamp((clientX - heroRect.left) / heroRect.width, 0, 1),
      y: clamp((clientY - heroRect.top) / heroRect.height, 0, 1),
    };

    if (visual) {
      const visualRect = visual.getBoundingClientRect();
      target.value = {
        x: clamp((clientX - visualRect.left) / visualRect.width, 0, 1),
        y: clamp((clientY - visualRect.top) / visualRect.height, 0, 1),
      };
    } else {
      target.value = { ...pointer.value };
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
    target.value = { x: 0.62, y: 0.48 };
    pointer.value = { x: 0.62, y: 0.48 };
  }

  function animate() {
    if (!reducedMotion.value) {
      if (!pointerActive.value) {
        driftPhase += 0.0065;
        target.value = {
          x: 0.62 + Math.sin(driftPhase) * 0.1,
          y: 0.48 + Math.cos(driftPhase * 0.85) * 0.07,
        };
        pointer.value = { ...target.value };
      }

      current.value = {
        x: lerp(current.value.x, target.value.x, pointerActive.value ? 0.14 : 0.06),
        y: lerp(current.value.y, target.value.y, pointerActive.value ? 0.14 : 0.06),
      };
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
    spotlightVars,
    tiltStyle,
    shineStyle,
    reflectionStyle,
    onPointerMove,
    onTouchMove,
    onPointerLeave,
  };
}
