<script setup lang="ts">
definePageMeta({ middleware: ['admin'], keepalive: true });

const api = useApi();
const { data: notifications, refresh } = useAdminCachedData('notifications', () =>
  api.get<Array<{ id: string; type: string; payload: Record<string, unknown>; createdAt: string; readAt: string | null }>>('/notifications').catch(() => []),
);

async function markRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Alertas" title="Centro de notificaciones" />
    <div class="space-y-3">
      <article
        v-for="n in notifications"
        :key="n.id"
        class="border p-4 flex justify-between gap-4"
        :class="n.readAt ? 'border-lux-gold/10 opacity-70' : 'border-lux-gold/30'"
      >
        <div>
          <p class="text-xs uppercase tracking-widest text-lux-gold">{{ n.type }}</p>
          <p class="text-sm text-lux-white-dim">{{ JSON.stringify(n.payload) }}</p>
          <p class="text-[10px] text-lux-white-dim mt-1">{{ n.createdAt }}</p>
        </div>
        <button v-if="!n.readAt" type="button" class="text-xs uppercase tracking-widest text-lux-gold" @click="markRead(n.id)">
          Marcar leída
        </button>
      </article>
      <p v-if="!notifications?.length" class="text-lux-white-dim">Sin notificaciones.</p>
    </div>
  </div>
</template>



