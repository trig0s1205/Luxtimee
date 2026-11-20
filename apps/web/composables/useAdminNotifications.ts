import {
  notificationHref,
  notificationMessage,
  notificationTone,
  type StaffNotification,
} from '~/utils/admin-notification';
import { invalidateAdminCache, invalidateAdminCachePrefix } from '~/utils/admin-cache';
import { createAdminInboxPoll } from '~/utils/admin-inbox-poll';

const SOUND_KEY = 'luxtimee-admin-notif-sound';
const DESKTOP_KEY = 'luxtimee-admin-notif-desktop';
const SEEN_KEY = 'luxtimee-admin-seen-ids';

let audioCtx: AudioContext | null = null;

export function unlockAdminNotificationAudio() {
  if (!import.meta.client) return;
  const Ctx = window.AudioContext;
  if (!audioCtx) audioCtx = new Ctx();
  void audioCtx.resume();
}

function playPreOrderChime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

function loadSeen() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function saveSeen(ids: Set<string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
}

function readDesktopPermission(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (!import.meta.client || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function useAdminNotifications() {
  const api = useApi();
  const toast = useToast();
  const unreadCount = useState('admin-notif-unread', () => 0);
  const soundEnabled = useState('admin-notif-sound', () => true);
  const desktopEnabled = useState('admin-notif-desktop', () => false);
  const desktopPermission = useState<'default' | 'granted' | 'denied' | 'unsupported'>(
    'admin-notif-desktop-permission',
    () => 'default',
  );
  const preOrderRevision = useState('admin-preorder-live', () => 0);

  const desktopButtonLabel = computed(() => {
    if (desktopPermission.value === 'denied') return 'Avisos de escritorio bloqueados';
    if (desktopEnabled.value) return 'Avisos de escritorio activos';
    return 'Activar avisos de escritorio';
  });

  function syncDesktopPreference() {
    desktopPermission.value = readDesktopPermission();
    const optedIn = import.meta.client
      ? localStorage.getItem(DESKTOP_KEY) === '1'
      : false;
    desktopEnabled.value = optedIn && desktopPermission.value === 'granted';
  }

  function setSoundEnabled(enabled: boolean) {
    soundEnabled.value = enabled;
    if (import.meta.client) localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
  }

  async function requestDesktopAlerts() {
    if (!import.meta.client || typeof Notification === 'undefined') {
      desktopPermission.value = 'unsupported';
      return;
    }
    if (Notification.permission === 'denied') {
      desktopPermission.value = 'denied';
      desktopEnabled.value = false;
      return;
    }
    if (Notification.permission === 'granted') {
      const next = !desktopEnabled.value;
      desktopEnabled.value = next;
      localStorage.setItem(DESKTOP_KEY, next ? '1' : '0');
      desktopPermission.value = 'granted';
      return;
    }
    const result = await Notification.requestPermission();
    desktopPermission.value = result;
    const granted = result === 'granted';
    desktopEnabled.value = granted;
    localStorage.setItem(DESKTOP_KEY, granted ? '1' : '0');
  }

  function showDesktopPreOrder(item: StaffNotification) {
    if (!import.meta.client || document.visibilityState !== 'hidden') return;
    if (!desktopEnabled.value || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted' || item.type !== 'NEW_PRE_ORDER') return;
    try {
      const note = new Notification(notificationMessage(item.type, item.payload), {
        body: 'Hay un pre-pedido nuevo en el panel.',
        tag: `pre-order-${item.id}`,
      });
      note.onclick = () => {
        window.focus();
        void navigateTo(notificationHref(item.type, item.payload));
        note.close();
      };
    } catch {
      /* el aviso en la app sigue disponible */
    }
  }

  async function refreshUnread() {
    const count = await api.get<number>('/notifications/unread-count');
    unreadCount.value = typeof count === 'number' ? count : 0;
    return unreadCount.value;
  }

  function showIncoming(items: StaffNotification[]) {
    let played = false;
    for (const item of [...items].reverse()) {
      const message = notificationMessage(item.type, item.payload);
      const tone = notificationTone(item.type);
      const href = notificationHref(item.type, item.payload);
      toast.show(message, tone, {
        sticky: item.type === 'NEW_PRE_ORDER',
        action: {
          label: 'Ver',
          onClick: () => { void navigateTo(href); },
        },
      });
      if (item.type === 'NEW_PRE_ORDER') {
        showDesktopPreOrder(item);
        if (soundEnabled.value && !played) {
          playPreOrderChime();
          played = true;
        }
      }
    }
  }

  function watchInbox() {
    let bootstrapped = false;
    let lastCount = -1;

    function onGesture() {
      unlockAdminNotificationAudio();
    }

    async function tick(forceList: boolean) {
      try {
        const count = await refreshUnread();
        const seen = loadSeen();
        const shouldList = !bootstrapped || forceList || count !== lastCount;
        if (!shouldList) return;
        const list = await api.get<StaffNotification[]>('/notifications').catch(() => []);
        const fresh = bootstrapped ? list.filter((item) => !seen.has(item.id)) : [];
        for (const item of list) seen.add(item.id);
        saveSeen(seen);
        bootstrapped = true;
        lastCount = count;
        if (fresh.length) {
          invalidateAdminCache('notifications');
          if (fresh.some((item) => item.type === 'NEW_PRE_ORDER')) {
            invalidateAdminCachePrefix('admin-pre-orders-active');
            preOrderRevision.value += 1;
          }
          showIncoming(fresh);
        }
      } catch {
        /* el siguiente ciclo reintenta */
      }
    }

    const poll = createAdminInboxPoll({
      tick: (forceList) => { void tick(forceList); },
      setInterval: (handler, ms) => window.setInterval(handler, ms),
      clearInterval: (id) => window.clearInterval(id),
    });

    function onVisibility() {
      poll.onVisibility(document.visibilityState === 'hidden');
    }

    onMounted(() => {
      soundEnabled.value = localStorage.getItem(SOUND_KEY) !== '0';
      syncDesktopPreference();
      window.addEventListener('pointerdown', onGesture);
      document.addEventListener('visibilitychange', onVisibility);
      poll.start(document.visibilityState === 'hidden');
    });

    onBeforeUnmount(() => {
      poll.stop();
      window.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  return {
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    desktopEnabled,
    desktopPermission,
    desktopButtonLabel,
    requestDesktopAlerts,
    preOrderRevision,
    refreshUnread,
    watchInbox,
  };
}
