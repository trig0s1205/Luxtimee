export const ADMIN_INBOX_VISIBLE_MS = 30_000;
export const ADMIN_INBOX_HIDDEN_MS = 60_000;

type IntervalId = number;

export function createAdminInboxPoll(deps: {
  tick: (forceList: boolean) => void;
  setInterval: (handler: () => void, ms: number) => IntervalId;
  clearInterval: (id: IntervalId) => void;
}) {
  let timer: IntervalId | null = null;
  let running = false;

  function arm(hidden: boolean) {
    if (timer != null) deps.clearInterval(timer);
    const ms = hidden ? ADMIN_INBOX_HIDDEN_MS : ADMIN_INBOX_VISIBLE_MS;
    timer = deps.setInterval(() => deps.tick(false), ms);
  }

  return {
    get running() {
      return running;
    },
    start(hidden: boolean) {
      running = true;
      deps.tick(false);
      arm(hidden);
    },
    stop() {
      running = false;
      if (timer != null) deps.clearInterval(timer);
      timer = null;
    },
    onVisibility(hidden: boolean) {
      if (!running) return;
      arm(hidden);
      if (!hidden) deps.tick(true);
    },
  };
}
