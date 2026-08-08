<script setup lang="ts">
useSeoMeta({ title: 'Sorteos LUXTIMEE | Detalles Exclusivos' });
</script>

<template>
  <div class="sorteos-section" style="min-height:80vh">
    <div class="sorteos-content reveal" style="max-width:700px;margin:0 auto;padding:120px 24px;text-align:center">
      <p class="section-label">Edición Limitada</p>
      <h1 class="sorteos-title">Sorteos Exclusivos <em>LUXTIMEE</em></h1>
      <p class="section-body" style="max-width:480px;margin:0 auto 40px">
        Forma parte de nuestra comunidad exclusiva. Al adquirir una pieza participas automáticamente.
      </p>
      <div class="text-left" style="max-width:500px;margin:0 auto 40px">
        <p class="section-label">¿Cómo participar?</p>
        <p class="section-body" style="max-width:none;margin-bottom:16px"><strong>01</strong> — Adquiere una pieza de la colección.</p>
        <p class="section-body" style="max-width:none;margin-bottom:16px"><strong>02</strong> — Registro automático vía WhatsApp al finalizar tu compra.</p>
        <p class="section-body" style="max-width:none"><strong>03</strong> — Transparencia total en cada sorteo.</p>
      </div>
      <div class="sorteos-cta-row" style="justify-content:center">
        <NuxtLink to="/catalogo" class="btn-primary">Explorar colección</NuxtLink>
        <NuxtLink to="/#contacto" class="btn-ghost">Asesoría</NuxtLink>
      </div>
      <NuxtLink to="/" class="detail-full-link" style="display:inline-block;margin-top:40px">← Volver al inicio</NuxtLink>
    </div>
  </div>
</template>
