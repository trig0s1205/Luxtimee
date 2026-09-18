export default defineNuxtPlugin(() => {
  const router = useRouter();
  const { scrollToSectionElement, isHomeSectionId } = useHomeSectionNav();

  router.afterEach((to) => {
    if (to.path !== '/' || !to.hash) return;
    const id = to.hash.slice(1);
    if (!isHomeSectionId(id)) return;
    nextTick(() => {
      requestAnimationFrame(() => scrollToSectionElement(id));
    });
  });
});
