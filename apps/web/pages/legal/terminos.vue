<script setup lang="ts">
const api = useApi();
const { data: legal } = await useAsyncData('legal-terms', () => api.get<{ termsDraft: string; termsPublished: boolean }>('/settings/legal/public'));
</script>

<template>
  <div class="px-6 md:px-16 py-24 max-w-3xl mx-auto prose prose-invert">
    <h1 class="font-display text-4xl text-lux-gold mb-8">Términos y Condiciones</h1>
    <p v-if="!legal?.termsPublished" class="text-amber-400 text-sm mb-6">Borrador — pendiente de aprobación de Álvaro.</p>
    <p class="text-lux-white-dim whitespace-pre-wrap">{{ legal?.termsDraft }}</p>
  </div>
</template>
