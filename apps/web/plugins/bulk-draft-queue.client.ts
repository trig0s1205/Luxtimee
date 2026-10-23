import { bindWatchBulkDraftRuntime } from '~/stores/watch-bulk-draft';

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore();
  const store = useWatchBulkDraftStore();
  bindWatchBulkDraftRuntime({
    uploadBase: useApiUploadUrl().replace(/\/$/, ''),
    run: (fn) => Promise.resolve(nuxtApp.runWithContext(fn)),
  });

  function boot() {
    auth.hydrateTokens();
    if (!auth.isSuperAdmin) return;
    store.hydrate();
  }

  boot();
  watch(() => auth.isSuperAdmin, (isSuper) => {
    if (isSuper) boot();
  });
});
