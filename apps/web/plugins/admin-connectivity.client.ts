/**
 * Avisos de conexión en el admin. No cierra sesión: solo informa y reintenta
 * validar la cookie cuando vuelve el internet.
 */
export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const toast = useToast();
  let offlineToastShown = false;

  function onOffline() {
    if (!auth.isStaff) return;
    if (offlineToastShown) return;
    offlineToastShown = true;
    toast.warning('Sin conexión, reintentando...');
  }

  function onOnline() {
    if (!auth.isStaff) return;
    offlineToastShown = false;
    toast.success('Conexión restablecida');
    void auth.fetchMe({ allowRefresh: true }).catch(() => null);
  }

  if (!navigator.onLine) onOffline();

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    });
  }
});
