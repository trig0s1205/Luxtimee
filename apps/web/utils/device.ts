export function isMobileBrowser() {
  if (!import.meta.client) return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
}
