import { resolveAccessToken } from '~/utils/auth-token';
import { invalidateAdminCachePrefix } from '~/utils/admin-cache';

export function useAdminRefetchWhenAuthed(refreshFns: Array<() => void | Promise<void>>) {
  const auth = useAuthStore();

  async function refetchAll() {
    invalidateAdminCachePrefix('admin-');
    invalidateAdminCachePrefix('inventory-');
    await Promise.all(refreshFns.map((fn) => fn()));
  }

  watch(
    () => resolveAccessToken(auth.accessToken),
    (token) => {
      if (token) void refetchAll();
    },
    { immediate: true },
  );
}
