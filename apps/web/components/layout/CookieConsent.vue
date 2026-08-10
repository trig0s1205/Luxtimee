<template>
  <Transition name="cookie-fade">
    <div v-if="visible" class="cookie-banner">
      <p class="cookie-banner-text">
        Usamos cookies para mejorar tu experiencia.
        <NuxtLink to="/politica-de-privacidad" class="cookie-banner-link">Política de datos</NuxtLink>
      </p>
      <button type="button" class="cookie-banner-btn" @click="accept">Aceptar</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { initGa4, trackGa4PageView } from '~/utils/ga4.client';

const visible = ref(false);
const config = useRuntimeConfig();
const route = useRoute();

onMounted(() => {
  if (!localStorage.getItem('LUXTIMEE-cookies')) {
    requestAnimationFrame(() => {
      visible.value = true;
    });
    return;
  }

  const measurementId = config.public.ga4MeasurementId as string;
  if (initGa4(measurementId)) {
    trackGa4PageView(route.fullPath, measurementId);
  }
});

function accept() {
  localStorage.setItem('LUXTIMEE-cookies', '1');
  visible.value = false;

  const measurementId = config.public.ga4MeasurementId as string;
  if (initGa4(measurementId)) {
    trackGa4PageView(route.fullPath, measurementId);
  }
}
</script>
