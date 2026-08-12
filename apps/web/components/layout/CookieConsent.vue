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
import { notifyAnalyticsConsent } from '~/utils/ga4.client';

const visible = ref(false);

onMounted(() => {
  if (!localStorage.getItem('LUXTIMEE-cookies')) {
    requestAnimationFrame(() => {
      visible.value = true;
    });
  }
});

function accept() {
  visible.value = false;
  notifyAnalyticsConsent();
}
</script>
