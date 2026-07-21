let lockedScrollY = 0;

function lockBodyScroll() {
  if (!import.meta.client) return;
  lockedScrollY = window.scrollY;
  document.body.classList.add('cart-scroll-lock');
  document.body.style.top = `-${lockedScrollY}px`;
}

function unlockBodyScroll() {
  if (!import.meta.client) return;
  document.body.classList.remove('cart-scroll-lock');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

export function useCartDrawer() {
  const open = useState('cart-drawer-open', () => false);

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
