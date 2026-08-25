<script setup lang="ts">
import type { HomepageContactConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageContactConfig }>();

const { openChat } = useWhatsApp();

function contactWhatsApp() {
  openChat(props.config.whatsappMessage || 'Hola LUXTIMEE, me gustaría recibir asesoría sobre el catálogo.');
}
</script>

<template>
  <section id="contacto" class="nosotros-section contact-section reveal">
    <div class="nosotros-intro">
      <div>
        <p class="section-label">{{ props.config.label }}</p>
        <h2 class="section-title">
          {{ props.config.title }}<br>
          <em>{{ props.config.titleEm }}</em>
        </h2>
      </div>
      <div>
        <p class="section-body">{{ props.config.body }}</p>
        <button type="button" class="btn-primary" style="margin-top:24px" @click="contactWhatsApp">
          {{ props.config.ctaText }}
        </button>
      </div>
    </div>
  </section>
</template>
