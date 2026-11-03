import {
  notificationHref,
  notificationMessage,
  notificationTone,
  type StaffNotification,
} from '~/utils/admin-notification';
import { invalidateAdminCache } from '~/utils/admin-cache';

const POLL_MS = 30_000;
const HIDDEN_PAUSE_MS = 5 * 60 * 1000;
const SOUND_KEY = 'luxtimee-admin-notif-sound';
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

export function useAdminNotifications() {
  const api = useApi();
  const toast = useToast();
  const unreadCount = useState('admin-notif-unread', () => 0);
  const soundEnabled = useState('admin-notif-sound', () => true);

  async function refreshUnread() {
    const count = await api.get<number>('/notifications/unread-count');
    unreadCount.value = typeof count === 'number' ? count : 0;
    return unreadCount.value;
  }

  function setSoundEnabled(enabled: boolean) {
    soundEnabled.value = enabled;
    if (import.meta.client) localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
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
      if (item.type === 'NEW_PRE_ORDER' && soundEnabled.value && !played) {
        playPreOrderChime();
        played = true;
      }
    }
  }

  function watchInbox() {
    let timer = 0;
    let pauseTimer = 0;
    let polling = false;
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
          showIncoming(fresh);
        }
      } catch {
        /* el siguiente ciclo reintenta */
      }
    }

    function start() {
      window.clearInterval(timer);
      void tick(bootstrapped);
      timer = window.setInterval(() => { void tick(false); }, POLL_MS);
      polling = true;
    }

    function stop() {
      window.clearInterval(timer);
      timer = 0;
      polling = false;
    }

    function onVisibility() {
      if (document.hidden) {
        window.clearTimeout(pauseTimer);
        pauseTimer = window.setTimeout(() => stop(), HIDDEN_PAUSE_MS);
        return;
      }
      window.clearTimeout(pauseTimer);
      if (!polling) start();
      else void tick(true);
    }

    onMounted(() => {
      soundEnabled.value = localStorage.getItem(SOUND_KEY) !== '0';
      window.addEventListener('pointerdown', onGesture);
      document.addEventListener('visibilitychange', onVisibility);
      start();
    });

    onBeforeUnmount(() => {
      stop();
      window.clearTimeout(pauseTimer);
      window.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  return { unreadCount, soundEnabled, setSoundEnabled, refreshUnread, watchInbox };
}
