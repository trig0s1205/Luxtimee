<script setup lang="ts">
const { openChat } = useWhatsApp();
const { fetchSession, isAuthed, loaded } = useWholesaleSession();

onMounted(async () => {
  await fetchSession();
});

useSeoMeta({ title: 'Mayoristas — LUXTIMEE' });
</script>

<template>
  <div class="mayoristas-page">
    <section v-if="loaded && isAuthed" class="disclaimer-box reveal" style="max-width:720px;margin:0 auto 2rem">
      <h3 class="section-title" style="font-size:22px;margin-bottom:12px">Ya tienes acceso activo</h3>
      <p class="section-body" style="max-width:none">
        Entra directamente a tu catálogo mayorista con precios y stock actualizados.
      </p>
      <NuxtLink to="/mayoristas/catalogo" class="btn-primary inline-block mt-6">
        Ir al catálogo mayorista →
      </NuxtLink>
    </section>

    <section class="manifesto-section reveal">
      <p class="manifesto-tag">Programa mayorista</p>
      <h1>Catálogo y precios exclusivos para mayoristas</h1>
      <p class="section-body" style="max-width:640px;margin:0 auto">
        Compra al por mayor con especificaciones completas, condiciones claras y precios reservados.
        Si ya te enviamos tu enlace privado, ábrelo directamente — no necesitas escribirnos de nuevo.
      </p>
    </section>

    <section class="disclaimer-box reveal" style="max-width:720px;margin:0 auto 2rem">
      <h3 class="section-title" style="font-size:22px;margin-bottom:12px">¿Cómo funciona?</h3>
      <ul class="plan-features" style="text-align:left;max-width:520px;margin:0 auto">
        <li>Los precios mayoristas no están en el catálogo público.</li>
        <li>Comprar 4 o más relojes en la web retail sigue siendo al precio de detal.</li>
        <li>Solo mayoristas autorizados acceden al catálogo por enlace privado.</li>
        <li>Mínimo recomendado: 4 unidades por pedido mayorista.</li>
      </ul>
    </section>

    <section class="bespoke-block reveal">
      <h3 class="section-title" style="font-size:clamp(24px,3vw,36px)">¿Aún no tienes tu enlace?</h3>
      <p class="section-body" style="max-width:560px;margin:1rem auto 0">
        Escríbenos con tu nombre, ciudad y volumen estimado. Si calificas, te enviaremos tu enlace privado de acceso al catálogo completo.
      </p>
      <button type="button" class="btn-primary mt-6" @click="openChat('Hola LUXTIMEE, deseo solicitar acceso al catálogo mayorista.')">
        Solicitar acceso →
      </button>
    </section>
  </div>
</template>
