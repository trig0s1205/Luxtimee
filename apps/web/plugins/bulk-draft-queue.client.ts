export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore();
  let started = false;

  async function boot() {
    auth.hydrateTokens();
    if (!auth.isSuperAdmin || started) return;
    started = true;
    const { bindWatchBulkDraftRuntime, useWatchBulkDraftStore } = await import('~/stores/watch-bulk-draft');
    bindWatchBulkDraftRuntime({
      uploadBase: useApiUploadUrl().replace(/\/$/, ''),
      run: (fn) => Promise.resolve(nuxtApp.runWithContext(fn)),
    });
    useWatchBulkDraftStore().hydrate();
  }

  void boot();
  watch(() => auth.isSuperAdmin, () => {
    void boot();
  });
});
