export function useReveal() {
  const { $gsap } = useNuxtApp();

  const reveal = (el: HTMLElement | null) => {
    if (!el || !import.meta.client || !$gsap) return;
    $gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      },
    );
  };

  return { reveal };
}
