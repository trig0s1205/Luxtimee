<script setup lang="ts">
import type { WarrantyTemplateDto } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const { data: templates } = await useAsyncData('warranties', () =>
  api.get<WarrantyTemplateDto[]>('/warranties').catch(() => []),
);
</script>

<template>
  <div>
    <UiSectionHeader label="Catálogo" title="Plantillas de garantía" />
    <div class="space-y-4">
      <article v-for="t in templates" :key="t.id" class="border border-lux-gold/15 p-4">
        <h3 class="font-display text-xl">{{ t.name }}</h3>
        <p class="text-xs text-lux-gold mb-2">{{ t.durationMonths }} meses</p>
        <p class="text-sm text-lux-white-dim">{{ t.terms }}</p>
      </article>
    </div>
  </div>
</template>
