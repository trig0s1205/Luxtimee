<script setup lang="ts">
const { openChat } = useWhatsApp();
const { fetchSession, isAuthed, loaded } = useWholesaleSession();

onMounted(async () => {
  await fetchSession();
});

useSeoMeta({ title: 'Mayoristas — LUXTIMEE' });
</script>

<template>
  <div class="mayoristas-page wholesale-landing">
    <section class="wholesale-landing__hero reveal">
      <p class="manifesto-tag">Programa mayorista</p>
      <h1>Catálogo y precios exclusivos para mayoristas</h1>
      <p class="wholesale-landing__lead">
        Compra al por mayor con especificaciones completas, condiciones claras y precios reservados.
      </p>
    </section>

    <section class="wholesale-landing__grid reveal">
      <article v-if="loaded && isAuthed" class="wholesale-panel wholesale-panel--accent">
        <p class="wholesale-panel__eyebrow">Acceso activo</p>
        <h2>Entra a tu catálogo privado</h2>
        <p>Precios mayoristas y stock actualizado en tiempo real.</p>
        <NuxtLink to="/mayoristas/catalogo" class="btn-primary wholesale-panel__cta">
          Ir al catálogo →
        </NuxtLink>
      </article>

      <article class="wholesale-panel">
        <p class="wholesale-panel__eyebrow">Condiciones</p>
        <h2>¿Cómo funciona?</h2>
        <ul class="wholesale-panel__list">
          <li>Los precios mayoristas no están en el catálogo público.</li>
          <li>Comprar 4+ relojes en la web retail sigue siendo precio de detal.</li>
          <li>Solo mayoristas autorizados acceden por enlace privado.</li>
          <li>Mínimo recomendado: 4 unidades por pedido.</li>
        </ul>
      </article>

      <article v-if="!isAuthed || !loaded" class="wholesale-panel wholesale-panel--wide">
        <p class="wholesale-panel__eyebrow">Enlace privado</p>
        <h2>Si ya te enviamos acceso</h2>
        <p>Abre el enlace que recibiste por WhatsApp o correo. No necesitas escribirnos de nuevo.</p>
      </article>
    </section>

    <section class="wholesale-landing__cta reveal">
      <h2>¿Aún no tienes tu enlace?</h2>
      <p>Escríbenos con tu nombre, ciudad y volumen estimado. Si calificas, te enviamos acceso al catálogo completo.</p>
      <button
        type="button"
        class="btn-primary"
        @click="openChat('Hola LUXTIMEE, deseo solicitar acceso al catálogo mayorista.')"
      >
        Solicitar acceso →
      </button>
    </section>
  </div>
</template>

<style scoped>
.wholesale-landing {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.wholesale-landing__hero {
  text-align: center;
  padding: 24px 0 36px;
  border-bottom: 1px solid rgba(200, 169, 110, 0.12);
}

.wholesale-landing__hero h1 {
  font-family: var(--font-display);
  font-size: clamp(28px, 4.5vw, 44px);
  font-weight: 300;
  line-height: 1.15;
  color: var(--white);
  margin-bottom: 14px;
}

.wholesale-landing__lead {
  max-width: 560px;
  margin: 0 auto;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.62);
}

.wholesale-landing__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 28px 0;
}

.wholesale-panel {
  padding: 24px 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
}

.wholesale-panel--accent {
  border-color: rgba(200, 169, 110, 0.35);
  background: linear-gradient(160deg, rgba(200, 169, 110, 0.1), rgba(200, 169, 110, 0.02));
}

.wholesale-panel--wide {
  grid-column: 1 / -1;
}

.wholesale-panel__eyebrow {
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold, #c8a96e);
  margin-bottom: 10px;
}

.wholesale-panel h2 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--white);
  margin-bottom: 10px;
}

.wholesale-panel p {
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.62);
}

.wholesale-panel__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.wholesale-panel__list li {
  position: relative;
  padding-left: 14px;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.72);
}

.wholesale-panel__list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold, #c8a96e);
}

.wholesale-panel__cta {
  display: inline-block;
  margin-top: 18px;
}

.wholesale-landing__cta {
  text-align: center;
  padding: 28px 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.wholesale-landing__cta h2 {
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 400;
  color: var(--white);
  margin-bottom: 10px;
}

.wholesale-landing__cta p {
  max-width: 520px;
  margin: 0 auto 18px;
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.62);
}

@media (max-width: 768px) {
  .wholesale-landing {
    padding: 20px 16px 48px;
  }

  .wholesale-landing__grid {
    grid-template-columns: 1fr;
  }
}
</style>
