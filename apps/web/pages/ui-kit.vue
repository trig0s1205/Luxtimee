<template>
  <div class="px-6 md:px-16 py-20 space-y-12">
    <UiSectionHeader label="Design System" title="UI Kit — Onyx & Oro" />
    <div class="flex flex-wrap gap-4">
      <UiLuxButton>Primary</UiLuxButton>
      <UiLuxButton variant="ghost">Ghost</UiLuxButton>
    </div>
    <div class="flex gap-3 flex-wrap">
      <UiLuxBadge tone="gold">Oro</UiLuxBadge>
      <UiLuxBadge tone="limited">Edición limitada</UiLuxBadge>
      <UiLuxBadge tone="mayorista">Mayorista</UiLuxBadge>
      <UiLuxBadge tone="detal">Detal</UiLuxBadge>
    </div>
    <div class="grid md:grid-cols-2 gap-4 max-w-4xl">
      <UiWatchCard v-for="watch in mockWatches.slice(0, 2)" :key="watch.id" :watch="watch" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { mockWatches } from '~/mocks/watches';
</script>
