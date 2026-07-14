<script setup lang="ts">
const api = useApi();
const { data: legal } = await useAsyncData('legal-privacy', () => api.get<{ privacyDraft: string; privacyPublished: boolean }>('/settings/legal/public'));
</script>

<template>
  <div class="px-6 md:px-16 py-24 max-w-3xl mx-auto">
    <h1 class="font-display text-4xl text-lux-gold mb-8">Política de Tratamiento de Datos</h1>
    <p v-if="!legal?.privacyPublished" class="text-amber-400 text-sm mb-6">Borrador — Ley 1581 de 2012. Pendiente de aprobación.</p>
    <p class="text-lux-white-dim whitespace-pre-wrap">{{ legal?.privacyDraft }}</p>
  </div>
</template>
