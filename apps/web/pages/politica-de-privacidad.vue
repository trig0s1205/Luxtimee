<script setup lang="ts">
import { privacySections } from '~/constants/legal-content';

useSeoMeta({
  title: 'Política de Privacidad — LUXTIMEE',
  description: 'Política de tratamiento de datos personales de LUXTIMEE. Ley 1581 de 2012 — Habeas Data Colombia.',
});
</script>

<template>
  <article class="legal-page">
    <p class="legal-updated">Última actualización: julio 2026</p>
    <h1>Política de Privacidad</h1>
    <p>
      En LUXTIMEE valoramos su confianza. Esta Política de Privacidad describe cómo recolectamos,
      usamos, almacenamos y protegemos sus datos personales cuando interactúa con nuestro sitio web,
      realiza compras o se comunica con nuestro equipo.
    </p>

    <section v-for="section in privacySections" :key="section.title">
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
