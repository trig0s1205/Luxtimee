<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

interface AuditLogDto {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user?: { name?: string; role?: string };
}

const auth = useAuthStore();
if (!auth.isSuperAdmin) throw createError({ statusCode: 403 });

const api = useApi();
const { data: logs } = await useAsyncData('audit-logs', () =>
  api.get<AuditLogDto[]>('/audit/logs'),
);
</script>

<template>
  <div>
    <UiSectionHeader label="Cumplimiento" title="Log de auditoría" />
    <div class="space-y-2 text-sm">
      <article v-for="log in logs ?? []" :key="log.id" class="border border-lux-gold/10 p-3">
        <p class="text-lux-gold text-xs uppercase">{{ log.action }} · {{ log.entity }}</p>
        <p class="text-lux-white-dim">{{ log.user?.name }} ({{ log.user?.role }}) — {{ log.createdAt }}</p>
      </article>
    </div>
  </div>
</template>
