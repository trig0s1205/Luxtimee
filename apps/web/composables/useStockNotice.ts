const AUTO_HIDE_MS = 3000;

export function useStockNotice() {
  const visible = useState('stock-notice-visible', () => false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => hide(), AUTO_HIDE_MS);
  }

  function hide() {
    visible.value = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { visible, show, hide };
}
