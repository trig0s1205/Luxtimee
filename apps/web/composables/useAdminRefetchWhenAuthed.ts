import { invalidateStaffAdminCaches } from '~/utils/admin-cache';

export function useAdminRefetchWhenAuthed(refreshFns: Array<() => void | Promise<void>>) {
  const auth = useAuthStore();
  const catalogStore = useAdminCatalogStore();

  async function refetchAll() {
    if (!auth.hasApiSession) return;
    invalidateStaffAdminCaches();
    catalogStore.invalidate();
    await Promise.all(refreshFns.map((fn) => fn()));
  }

  watch(
    () => (auth.loaded && auth.hasApiSession ? auth.sessionCheckedAt : 0),
    (ts) => {
      if (ts) void refetchAll();
    },
    { immediate: true },
  );
}
