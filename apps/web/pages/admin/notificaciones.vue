<script setup lang="ts">
import {
  formatRelativeTime,
  notificationHref,
  notificationMessage,
  type StaffNotification,
} from '~/utils/admin-notification';

definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const { refreshUnread } = useAdminNotifications();
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

const { data: notifications, refresh, pending } = useAdminCachedData('notifications', () =>
  api.get<StaffNotification[]>('/notifications').catch(() => []),
);

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
        <NuxtLink class="admin-pagination-btn" :to="notificationHref(n.type, n.payload)" @click="!n.readAt && markRead(n.id)">
          Ver pedido
        </NuxtLink>
      </article>
      <p v-if="!notifications?.length" class="text-lux-white-dim">Sin notificaciones.</p>
    </div>
  </div>
</template>

<style>
.admin-notification-toolbar {
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
