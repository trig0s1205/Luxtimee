<script setup lang="ts">
definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const { data: notifications, refresh, pending } = useAdminCachedData('notifications', () =>
  api.get<Array<{ id: string; type: string; payload: Record<string, unknown>; createdAt: string; readAt: string | null }>>('/notifications').catch(() => []),
);

async function markRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
  await refresh();
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
    <div class="space-y-3">
      <article
        v-for="n in notifications"
        :key="n.id"
        class="admin-notification"
        :class="n.readAt ? 'admin-notification--read' : ''"
      >
        <div class="admin-notification-body">
          <p class="admin-notification-type">{{ n.type }}</p>
          <p class="admin-notification-payload">{{ JSON.stringify(n.payload) }}</p>
          <p class="admin-notification-date">{{ n.createdAt }}</p>
        </div>
        <button v-if="!n.readAt" type="button" class="admin-pagination-btn" @click="markRead(n.id)">
          Marcar leída
        </button>
      </article>
      <p v-if="!notifications?.length" class="text-lux-white-dim">Sin notificaciones.</p>
    </div>
  </div>
</template>

<style>
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
}

.admin-notification-type {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-gold);
}

.admin-notification-payload,
.admin-notification-date {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--lux-white-dim);
  overflow-wrap: anywhere;
}

.admin-notification-date {
  font-size: 10px;
}

@media (max-width: 640px) {
  .admin-notification {
    flex-direction: column;
  }
}
</style>



