import { invalidateStaffAdminCaches } from '~/utils/admin-cache';
import { resolveAccessToken } from '~/utils/auth-token';

export function useAdminRefetchWhenAuthed(refreshFns: Array<() => void | Promise<void>>) {
  const auth = useAuthStore();
  const catalogStore = useAdminCatalogStore();

  async function refetchAll() {
    if (!resolveAccessToken(auth.accessToken)) {
      try {
        await auth.ensureAccessToken();
      } catch {
        return;
      }
    }
    invalidateStaffAdminCaches();
    catalogStore.invalidate();
    await Promise.all(refreshFns.map((fn) => fn()));
  }

  watch(
    () => (
      auth.loaded && auth.isStaff && !auth.isLocalSession && resolveAccessToken(auth.accessToken)
        ? auth.sessionCheckedAt
        : 0
    ),
    (ts) => {
      if (ts) void refetchAll();
    },
    { immediate: true },
  );
}
