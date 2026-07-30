<script setup lang="ts">
const route = useRoute();
const { activate } = useWholesaleSession();

const token = computed(() => String(route.params.token ?? ''));
const error = ref('');
const loading = ref(true);

onMounted(async () => {
  if (!token.value) {
    error.value = 'Enlace inválido.';
    loading.value = false;
    return;
  }
  try {
    await activate(token.value);
    await navigateTo('/mayoristas/catalogo', { replace: true });
  } catch {
    error.value = 'Este enlace no es válido o fue revocado.';
    loading.value = false;
  }
});

useSeoMeta({ title: 'Acceso mayorista — Luxtime' });
</script>

<template>
  <div class="min-h-screen bg-lux-black flex items-center justify-center px-6">
    <div class="text-center max-w-md">
      <p v-if="loading && !error" class="text-lux-white-dim">Abriendo catálogo mayorista...</p>
      <template v-else-if="error">
        <p class="text-lux-white-dim mb-4">{{ error }}</p>
        <NuxtLink to="/mayoristas" class="text-lux-gold">Volver a mayoristas</NuxtLink>
      </template>
    </div>
  </div>
</template>
