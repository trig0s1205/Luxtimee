<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'account' });

const api = useApi();
const form = reactive({ address: '', phone: '' });
const saved = ref(false);

const { data } = await useAsyncData('saved-shipping', () => api.get<{ address: string; phone: string } | null>('/account/shipping'));
if (data.value) {
  form.address = data.value.address;
  form.phone = data.value.phone;
}

async function save() {
  await api.put('/account/shipping', form);
  saved.value = true;
}
</script>

<template>
  <div class="max-w-xl">
    <AccountAccountNav />
    <UiSectionHeader label="Mi cuenta" title="Datos de envío" />
    <p class="text-sm text-lux-white-dim mb-6 -mt-4">Autocompletan el checkout en tus próximas compras.</p>
    <form class="space-y-4" @submit.prevent="save">
      <UiLuxInput v-model="form.address" placeholder="Dirección predeterminada" />
      <UiLuxInput v-model="form.phone" placeholder="Teléfono" />
      <UiLuxButton type="submit">Guardar</UiLuxButton>
      <p v-if="saved" class="text-lux-gold text-sm">Datos guardados.</p>
    </form>
  </div>
</template>
