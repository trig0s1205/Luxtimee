function resolveStorefrontBackFallback(path: string): string {
  if (path.startsWith('/producto/')) return '/catalogo';
  if (path.startsWith('/mayoristas/catalogo/')) return '/mayoristas/catalogo';
  if (path.startsWith('/mayoristas/')) return '/mayoristas';
  if (path === '/catalogo') return '/';
  if (path === '/carrito' || path === '/checkout') return '/catalogo';
  if (path.startsWith('/certificado/')) return '/catalogo';
  if (path.startsWith('/acceso/')) return '/vigilancia';
  return '/';
}

export function useStorefrontBack() {
  const route = useRoute();
  const router = useRouter();

  const showBack = computed(() => route.path !== '/');

  const fallbackPath = computed(() => resolveStorefrontBackFallback(route.path));

  async function goBack() {
    if (import.meta.client) {
      const state = window.history.state as { back?: string | null } | null;
      if (state?.back) {
        router.back();
        return;
      }
    }
    await navigateTo(fallbackPath.value);
  }

  return { showBack, goBack, fallbackPath };
}
