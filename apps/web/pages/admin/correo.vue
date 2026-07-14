<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });
const api = useApi();
const { data: contacts, refresh } = await useAsyncData('pending-contacts', () => api.get('/marketing/contacts/pending'));

async function validate(id: string, approve: boolean) {
  await api.patch(`/marketing/contacts/${id}/validate`, { approve });
  await refresh();
}
</script>

<template>
  <div>
    <UiSectionHeader label="Marketing" title="Validar correos" />
    <div class="space-y-3">
      <article v-for="c in contacts" :key="c.id" class="border border-lux-gold/15 p-4 flex justify-between items-center">
        <span>{{ c.email }}</span>
        <div class="flex gap-2">
          <UiLuxButton @click="validate(c.id, true)">Validar</UiLuxButton>
          <UiLuxButton variant="ghost" @click="validate(c.id, false)">Rechazar</UiLuxButton>
        </div>
      </article>
    </div>
  </div>
</template>
