<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error.statusCode === 404);

useHead({
  title: is404.value ? 'Ruta no encontrada — LUXTIMEE' : 'Error — LUXTIMEE',
});

useSeoMeta({ robots: 'noindex, nofollow' });

function goHome() {
  clearError({ redirect: '/' });
}
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <p class="error-code">{{ is404 ? '404' : error.statusCode }}</p>

      <template v-if="is404">
        <h1 class="error-title">Esta ruta <em>no existe</em></h1>
        <p class="error-message">
          ¿Quieres intentar algo malo? Te tenemos monitoreado.
        </p>
      </template>

      <template v-else>
        <h1 class="error-title">Algo salió <em>mal</em></h1>
        <p class="error-message">
          Ocurrió un error inesperado. Intenta de nuevo o vuelve al inicio.
        </p>
      </template>

      <button type="button" class="btn-primary error-home-btn" @click="goHome">
        Volver al inicio
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--black, #0a0a0a);
}

.error-card {
  width: 100%;
  max-width: 520px;
  padding: 48px 40px;
  text-align: center;
  border: 1px solid rgba(200, 169, 110, 0.15);
  background: rgba(255, 255, 255, 0.02);
}

.error-code {
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lux-gold, #c8a96e);
  margin-bottom: 16px;
}

.error-title {
  font-family: var(--font-display, 'Cormorant Garamond', serif);
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 300;
  color: var(--white, #f5f5f5);
  margin-bottom: 16px;
  line-height: 1.2;
}

.error-title em {
  font-style: italic;
  color: var(--lux-gold, #c8a96e);
}

.error-message {
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 14px;
  line-height: 1.7;
  color: var(--lux-white-dim, rgba(245, 245, 245, 0.65));
  margin-bottom: 32px;
}

.error-home-btn {
  width: 100%;
  max-width: 280px;
}
</style>
