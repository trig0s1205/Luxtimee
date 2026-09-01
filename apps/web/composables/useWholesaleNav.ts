export function useWholesaleNav() {
  const route = useRoute();

  const isWholesaleCatalogArea = computed(() => {
    const path = route.path;
    return path.startsWith('/mayoristas/catalogo')
      || path === '/mayoristas/checkout'
      || path === '/mayoristas/carrito';
  });

  const isWholesaleLanding = computed(() => {
    const path = route.path;
    return path === '/mayoristas' || path.startsWith('/mayoristas/acceso');
  });

  const showWholesaleNavCart = computed(() => isWholesaleCatalogArea.value);

  return {
    isWholesaleCatalogArea,
    isWholesaleLanding,
    showWholesaleNavCart,
  };
}
