<script setup lang="ts">
import type { WhatsappSettingDto } from '@luxtime/shared';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const api = useApi();
const form = reactive<WhatsappSettingDto>({ url: '', messagePrefix: '' });
const saved = ref(false);

const { data } = await useAsyncData('whatsapp-settings', async () => {
  const res = await api.get<WhatsappSettingDto>('/settings/whatsapp');
  Object.assign(form, res);
  return res;
});

async function save() {
  await api.patch('/settings/whatsapp', form);
  saved.value = true;
}
</script>

<template>
  <div class="max-w-xl space-y-4">
    <UiSectionHeader label="Integraciones" title="WhatsApp" />
    <UiLuxInput v-model="form.url" placeholder="URL wa.me oficial" />
    <UiLuxInput v-model="form.messagePrefix" placeholder="Prefijo del mensaje" />
    <UiLuxButton @click="save">Guardar</UiLuxButton>
    <p v-if="saved" class="text-lux-gold text-sm">Configuración guardada.</p>
  </div>
</template>
