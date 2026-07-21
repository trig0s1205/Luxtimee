<script setup lang="ts">
import { termsSections } from '~/constants/legal-content';

useSeoMeta({
  title: 'Términos y Condiciones — Luxtime',
  description: 'Términos y condiciones de compra de relojes de lujo en Luxtime. Envíos nacionales en Colombia.',
});
</script>

<template>
  <article class="legal-page">
    <p class="legal-updated">Última actualización: julio 2026</p>
    <h1>Términos y Condiciones</h1>
    <p>
      Bienvenido a Luxtime. Al acceder a nuestro sitio web o adquirir nuestros productos, usted acepta
      los presentes Términos y Condiciones, los cuales regulan la relación comercial entre usted y
      Luxtime Luxury Timepieces.
    </p>

    <section v-for="section in termsSections" :key="section.title">
      <h2>{{ section.title }}</h2>
      <p v-for="(paragraph, index) in section.paragraphs" :key="`${section.title}-p-${index}`">
        {{ paragraph }}
      </p>
      <ul v-if="section.list?.length">
        <li v-for="item in section.list" :key="item">{{ item }}</li>
      </ul>
    </section>
  </article>
</template>
