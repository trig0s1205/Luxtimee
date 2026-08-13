<script setup lang="ts">
import { invalidateAdminCache } from '~/utils/admin-cache';

definePageMeta({ middleware: ['admin'], keepalive: true });

interface ReviewDto {
  id: string;
  customerName: string;
  rating: number;
  body: string;
}

const api = useApi();
const { data: reviews, refresh, pending } = useAdminCachedData('admin-reviews', () =>
  api.get<ReviewDto[]>('/reviews/pending'),
);

async function moderate(id: string, approve: boolean) {
  await api.patch(`/reviews/${id}/status`, { status: approve ? 'PUBLISHED' : 'REJECTED' });
  invalidateAdminCache('admin-reviews');
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader
      label="Marketing"
      title="Moderar reseñas"
      :refreshable="true"
      :refreshing="pending"
      @refresh="refresh()"
    />
    <div class="space-y-4">
      <article v-for="r in reviews ?? []" :key="r.id" class="border border-lux-gold/15 p-4">
        <p class="font-display text-lg">{{ r.customerName }} · {{ r.rating }}/5</p>
        <p class="text-sm text-lux-white-dim mb-3">{{ r.body }}</p>
        <div class="flex gap-2">
          <UiLuxButton @click="moderate(r.id, true)">Publicar</UiLuxButton>
          <UiLuxButton variant="ghost" @click="moderate(r.id, false)">Rechazar</UiLuxButton>
        </div>
      </article>
    </div>
  </div>
</template>



