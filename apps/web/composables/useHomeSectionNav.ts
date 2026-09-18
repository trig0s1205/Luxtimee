const HOME_SECTION_IDS = new Set(['nosotros', 'contacto']);

export function useHomeSectionNav() {
  const route = useRoute();

  function stripHashFromUrl() {
    if (!import.meta.client) return;
    const { pathname, search } = window.location;
    if (!window.location.hash) return;
    history.replaceState(window.history.state, '', `${pathname}${search}`);
  }

  function scrollToSectionElement(sectionId: string) {
    if (!import.meta.client) return;
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    stripHashFromUrl();
  }

  async function scrollToHomeSection(sectionId: string) {
    if (!HOME_SECTION_IDS.has(sectionId)) return;

    if (route.path !== '/') {
      await navigateTo('/');
      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSectionElement(sectionId));
      });
      return;
    }

    scrollToSectionElement(sectionId);
  }

  function isHomeSectionId(id: string) {
    return HOME_SECTION_IDS.has(id);
  }

  return { scrollToHomeSection, scrollToSectionElement, stripHashFromUrl, isHomeSectionId };
}
