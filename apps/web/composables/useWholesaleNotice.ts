export function useWholesaleNotice() {
  const visible = useState('wholesale-notice-visible', () => false);

  function show() {
    visible.value = true;
  }

  function hide() {
    visible.value = false;
  }

  return { visible, show, hide };
}
