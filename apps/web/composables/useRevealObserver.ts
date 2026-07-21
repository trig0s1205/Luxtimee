export function useRevealObserver() {
  let observer: IntersectionObserver | null = null;

  function observe(root: ParentNode = document) {
    if (!import.meta.client) return;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    root.querySelectorAll('.reveal:not(.visible)').forEach((el) => observer!.observe(el));
  }

  onMounted(() => observe());
  onUnmounted(() => observer?.disconnect());

  return { observe };
}
