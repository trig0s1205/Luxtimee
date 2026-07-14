<template>
  <div
    v-if="visible"
    class="fixed bottom-0 inset-x-0 z-50 bg-lux-black-2 border-t border-lux-gold/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4"
  >
    <p class="text-xs text-lux-white-dim max-w-2xl">
      Usamos cookies para mejorar tu experiencia. Consulta nuestra
      <NuxtLink to="/legal/privacidad" class="text-lux-gold underline">política de datos</NuxtLink>.
    </p>
    <UiLuxButton @click="accept">Aceptar</UiLuxButton>
  </div>
</template>

<script setup lang="ts">
const visible = ref(false);

onMounted(() => {
  if (!localStorage.getItem('luxtime-cookies')) visible.value = true;
});

function accept() {
  localStorage.setItem('luxtime-cookies', '1');
  visible.value = false;
}
</script>
