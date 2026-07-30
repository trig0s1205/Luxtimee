import type { WholesaleSessionDto } from '@luxtime/shared';

export function useWholesaleSession() {
  const api = useApi();
  const session = useState<WholesaleSessionDto | null>('wholesale-session', () => null);
  const loaded = useState('wholesale-session-loaded', () => false);

  async function fetchSession() {
    if (!import.meta.client) return;

    try {
      session.value = await api.get<WholesaleSessionDto | null>('/wholesale-access/session');
    } catch {
      session.value = null;
    } finally {
      loaded.value = true;
    }
  }

  async function activate(token: string) {
    session.value = await api.post<WholesaleSessionDto>('/wholesale-access/session', { token });
    loaded.value = true;
  }

  async function logout() {
    await api.post('/wholesale-access/session/logout');
    session.value = null;
    loaded.value = true;
  }

  const isAuthed = computed(() => !!session.value);

  return { session, loaded, isAuthed, fetchSession, activate, logout };
}
