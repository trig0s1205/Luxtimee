let lockCount = 0;
let scrollbarWidth = 0;

function getScrollbarWidth() {
  if (!import.meta.client) return 0;
  return window.innerWidth - document.documentElement.clientWidth;
}

export function useCartDrawer() {
  const open = useState('cart-drawer-open', () => false);

  function lockBodyScroll() {
    if (!import.meta.client) return;
    lockCount += 1;
    if (lockCount > 1) return;
    scrollbarWidth = getScrollbarWidth();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  function unlockBodyScroll() {
    if (!import.meta.client) return;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  function openCart() {
    if (open.value) return;
    lockBodyScroll();
    open.value = true;
  }

  function closeCart() {
    if (!open.value) return;
    open.value = false;
    unlockBodyScroll();
  }

  return { open, openCart, closeCart };
}
