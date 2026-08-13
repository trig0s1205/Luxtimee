<script setup lang="ts">
import {
  SOCIAL_PROOF_CITIES,
  SOCIAL_PROOF_FIRST_NAMES,
  SOCIAL_PROOF_LAST_NAMES,
  SOCIAL_PROOF_MAX_INTERVAL_MS,
  SOCIAL_PROOF_MAX_PER_DAY,
  SOCIAL_PROOF_MIN_INTERVAL_MS,
} from '~/constants/social-proof-pools';

const LOG_KEY = 'luxtimee-social-proof-log';

type ToastPayload = {
  name: string;
  city: string;
  product: string;
  minutesAgo: number;
};

const visible = ref(false);
const current = ref<ToastPayload | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const route = useRoute();
const catalog = useCatalogData();
const watchPool = ref<string[]>([]);

const hiddenRoute = computed(() =>
  route.path.startsWith('/admin')
  || route.path.startsWith('/checkout')
  || route.path.includes('/checkout'),
);

function readLog(): number[] {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) as number[] : [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter((ts) => ts > dayAgo);
  } catch {
    return [];
  }
}

function writeLog(entries: number[]) {
  if (!import.meta.client) return;
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function buildToast(): ToastPayload | null {
  if (!watchPool.value.length) return null;
  const first = randomItem(SOCIAL_PROOF_FIRST_NAMES);
  const last = randomItem(SOCIAL_PROOF_LAST_NAMES);
  return {
    name: `${first} ${last}`,
    city: randomItem(SOCIAL_PROOF_CITIES),
    product: randomItem(watchPool.value),
    minutesAgo: Math.floor(Math.random() * 175) + 5,
  };
}

function scheduleNext(delayMs?: number) {
  if (timer) clearTimeout(timer);
  const delay = delayMs ?? (
    SOCIAL_PROOF_MIN_INTERVAL_MS
    + Math.random() * (SOCIAL_PROOF_MAX_INTERVAL_MS - SOCIAL_PROOF_MIN_INTERVAL_MS)
  );
  timer = setTimeout(showToast, delay);
}

function showToast() {
  if (hiddenRoute.value) {
    scheduleNext(60_000);
    return;
  }

  const log = readLog();
  if (log.length >= SOCIAL_PROOF_MAX_PER_DAY) return;

  const payload = buildToast();
  if (!payload) {
    scheduleNext(90_000);
    return;
  }

  current.value = payload;
  visible.value = true;
  writeLog([...log, Date.now()]);

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    visible.value = false;
    scheduleNext();
  }, 6500);
}

function dismiss() {
  visible.value = false;
  if (hideTimer) clearTimeout(hideTimer);
  scheduleNext();
}

onMounted(async () => {
  try {
    const res = await catalog.listCatalog({ limit: 60, available: 'true' });
    watchPool.value = res.data.map((w) => `${w.brand.name} ${w.model}`.trim()).filter(Boolean);
  } catch {
    watchPool.value = ['Rolex Submariner', 'Omega Seamaster', 'Cartier Santos', 'Rolex Daytona'];
  }

  const initialDelay = 45_000 + Math.random() * 60_000;
  scheduleNext(initialDelay);
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
  if (hideTimer) clearTimeout(hideTimer);
});

watch(hiddenRoute, (hidden) => {
  if (hidden) visible.value = false;
});
</script>

<template>
  <Transition name="social-proof">
    <aside
      v-if="visible && current && !hiddenRoute"
      class="social-proof-toast"
      role="status"
      aria-live="polite"
    >
      <button type="button" class="social-proof-toast__close" aria-label="Cerrar" @click="dismiss">×</button>
      <p class="social-proof-toast__text">
        <strong>{{ current.name }}</strong> en {{ current.city }} compró
        <span class="social-proof-toast__product">{{ current.product }}</span>
        hace {{ current.minutesAgo }} min
      </p>
    </aside>
  </Transition>
</template>

<style scoped>
.social-proof-toast {
  position: fixed;
  left: 16px;
  bottom: 88px;
  z-index: 90;
  max-width: min(340px, calc(100vw - 32px));
  padding: 14px 36px 14px 16px;
  background: var(--black-2);
  border: 1px solid rgba(200, 169, 110, 0.22);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.social-proof-toast__text {
  font-size: 12px;
  line-height: 1.55;
  color: var(--white-dim);
}

.social-proof-toast__text strong {
  color: var(--white);
  font-weight: 600;
}

.social-proof-toast__product {
  color: var(--gold);
}

.social-proof-toast__close {
  position: absolute;
  top: 6px;
  right: 8px;
  border: none;
  background: none;
  color: var(--white-dim);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.social-proof-enter-active,
.social-proof-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.social-proof-enter-from,
.social-proof-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 640px) {
  .social-proof-toast {
    left: 12px;
    bottom: 76px;
  }
}
</style>
