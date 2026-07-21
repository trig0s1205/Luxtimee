export function useProductModal() {
  const open = useState('product-modal-open', () => false);
  const slug = useState<string | null>('product-modal-slug', () => null);

  function openProduct(productSlug: string) {
    slug.value = productSlug;
    open.value = true;
    if (import.meta.client) document.body.style.overflow = 'hidden';
  }

  function closeProduct() {
    open.value = false;
    slug.value = null;
    if (import.meta.client) document.body.style.overflow = '';
  }

  return { open, slug, openProduct, closeProduct };
}
