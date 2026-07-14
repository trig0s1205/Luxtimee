<script setup lang="ts">
import type { CareTemplateDto } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const { data: templates } = await useAsyncData('care', () =>
  api.get<CareTemplateDto[]>('/care').catch(() => []),
);
</script>

<template>
  <div>
    <UiSectionHeader label="Catálogo" title="Plantillas de cuidado" />
    <div class="space-y-4">
      <article v-for="t in templates" :key="t.id" class="border border-lux-gold/15 p-4">
        <h3 class="font-display text-xl">{{ t.name }}</h3>
        <p class="text-sm text-lux-white-dim">{{ t.instructions }}</p>
      </article>
    </div>
  </div>
</template>
