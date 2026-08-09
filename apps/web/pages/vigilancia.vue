<script setup lang="ts">
definePageMeta({ layout: false });

useHead({ title: 'Acceso restringido — LUXTIMEE' });
useSeoMeta({ robots: 'noindex, nofollow' });
</script>

<template>
  <div class="trap-page">
    <div class="trap-scanline" aria-hidden="true" />

    <div class="trap-card">
      <p class="trap-code">◈ ACCESO DENEGADO ◈</p>
      <h1 class="trap-title">¿Estás intentando <em>algo</em>?</h1>
      <p class="trap-message">
        Esta zona no es para curiosos. Te tenemos vigilado.
      </p>
      <p class="trap-sub">
        Si no sabes a qué viniste, mejor vuelve por donde llegaste.
      </p>
      <NuxtLink to="/" class="btn-primary trap-home-btn">
        Volver al inicio
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.trap-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #050505;
  position: relative;
  overflow: hidden;
}

.trap-scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(200, 169, 110, 0.03) 2px,
    rgba(200, 169, 110, 0.03) 4px
  );
  pointer-events: none;
}

.trap-card {
  position: relative;
  width: 100%;
  max-width: 540px;
  padding: 56px 40px;
  text-align: center;
  border: 1px solid rgba(200, 169, 110, 0.2);
  background: rgba(10, 10, 10, 0.95);
  box-shadow: 0 0 60px rgba(200, 169, 110, 0.06);
}

.trap-code {
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 10px;
  letter-spacing: 0.35em;
  color: rgba(200, 169, 110, 0.7);
  margin-bottom: 24px;
}

.trap-title {
  font-family: var(--font-display, 'Cormorant Garamond', serif);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 300;
  color: var(--white, #f5f5f5);
  margin-bottom: 20px;
  line-height: 1.15;
}

.trap-title em {
  font-style: italic;
  color: var(--lux-gold, #c8a96e);
}

.trap-message {
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 15px;
  line-height: 1.7;
  color: var(--white, #f5f5f5);
  margin-bottom: 12px;
}

.trap-sub {
  font-family: var(--font-body, 'Montserrat', sans-serif);
  font-size: 12px;
  line-height: 1.6;
  color: var(--lux-white-dim, rgba(245, 245, 245, 0.45));
  margin-bottom: 36px;
}

.trap-home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 280px;
  text-decoration: none;
}
</style>
