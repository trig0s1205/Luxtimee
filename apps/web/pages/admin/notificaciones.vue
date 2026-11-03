<script setup lang="ts">
import {
  formatRelativeTime,
  notificationHref,
  notificationMessage,
  type StaffNotification,
} from '~/utils/admin-notification';

definePageMeta({ middleware: ['admin'], keepalive: true });

useHead({
  title: 'Notificaciones',
  meta: [{ name: 'robots', key: 'robots', content: 'noindex, nofollow' }],
});

const api = useApi();
const toast = useToast();
const { refreshUnread, unreadCount } = useAdminNotifications();
const now = ref(Date.now());
let clock = 0;

onMounted(() => {
  clock = window.setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  window.clearInterval(clock);
});

const { data: notifications, refresh, pending, error } = useAdminCachedData(
  'notifications',
  () => api.get<StaffNotification[]>('/notifications'),
  { staleTime: 0 },
);

const hasRead = computed(() => (notifications.value ?? []).some((n) => !!n.readAt));

watch(unreadCount, (count, previous) => {
  if (previous !== undefined && count !== previous) void refresh();
});

onActivated(() => {
  void refresh();
});

async function markRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
  await refresh();
  await refreshUnread();
}

async function markAllRead() {
  await api.patch('/notifications/read-all');
  await refresh();
  await refreshUnread();
}

async function deleteOne(id: string) {
  await api.del(`/notifications/${id}`);
  await refresh();
  await refreshUnread();
  toast.success('Notificación eliminada');
}

async function deleteRead() {
  if (!hasRead.value) return;
  const ok = window.confirm('¿Eliminar todas las notificaciones leídas? Esta acción no se puede deshacer.');
  if (!ok) return;
  await api.del('/notifications/read');
  await refresh();
  await refreshUnread();
  toast.success('Notificaciones leídas eliminadas');
}

async function openNotification(item: StaffNotification) {
  if (!item.readAt) await markRead(item.id);
  await navigateTo(notificationHref(item.type, item.payload));
}
</script>

<template>
  <div>
    <UiSectionHeader
      label="Alertas"
      title="Centro de notificaciones"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <div class="admin-notification-toolbar">
      <button type="button" class="admin-pagination-btn" @click="markAllRead">
        Marcar todas como leídas
      </button>
      <button
        type="button"
        class="admin-pagination-btn"
        :disabled="!hasRead"
        @click="deleteRead"
      >
        Eliminar leídas
      </button>
    </div>
    <div class="space-y-3">
      <article
        v-for="n in notifications"
        :key="n.id"
        class="admin-notification"
        :class="n.readAt ? 'admin-notification--read' : ''"
      >
        <button type="button" class="admin-notification-body" @click="openNotification(n)">
          <p class="admin-notification-type">{{ notificationMessage(n.type, n.payload) }}</p>
          <p class="admin-notification-date">{{ formatRelativeTime(n.createdAt, now) }}</p>
        </button>
        <div class="admin-notification-actions">
          <NuxtLink class="admin-pagination-btn" :to="notificationHref(n.type, n.payload)" @click="!n.readAt && markRead(n.id)">
            Ver
          </NuxtLink>
          <button
            type="button"
            class="admin-notification-delete"
            aria-label="Eliminar notificación"
            title="Eliminar"
            @click="deleteOne(n.id)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </article>
      <p v-if="error && !notifications?.length" class="text-lux-white-dim">No se pudieron cargar las notificaciones.</p>
      <p v-else-if="!pending && !notifications?.length" class="text-lux-white-dim">Sin notificaciones.</p>
    </div>
  </div>
</template>

<style>
.admin-notification-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
}

.admin-notification {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(200, 169, 110, 0.3);
  max-width: 100%;
}

.admin-notification--read {
  border-color: rgba(200, 169, 110, 0.1);
  opacity: 0.7;
}

.admin-notification-body {
  min-width: 0;
  flex: 1;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.admin-notification-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.admin-notification-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(200, 169, 110, 0.25);
  background: transparent;
  color: var(--lux-white-dim);
  cursor: pointer;
}

.admin-notification-delete:hover {
  color: #ffb4b4;
  border-color: rgba(255, 120, 120, 0.45);
}

.admin-notification-type {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--lux-gold);
}

.admin-notification-date {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--lux-white-dim);
}

@media (max-width: 640px) {
  .admin-notification {
    flex-direction: column;
  }
}
</style>
