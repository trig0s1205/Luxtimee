<script setup lang="ts">
import type { HomepageStatementConfig } from '@luxtime/shared';

const props = defineProps<{ config: HomepageStatementConfig }>();
</script>

<template>
  <section class="statement-section reveal">
    <p class="statement-text">
      {{ props.config.text }}<br>
      <em>{{ props.config.textEm }}</em>
    </p>
    <p class="statement-sub">{{ props.config.sub }}</p>
  </section>
</template>
