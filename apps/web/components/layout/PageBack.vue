<script setup lang="ts">
const { t } = useLocale();
const { showBack, goBack } = useStorefrontBack();
</script>

<template>
  <button
    v-if="showBack"
    type="button"
    class="nav-back page-back"
    :aria-label="t('nav.back')"
    @click="goBack"
  >
    <UiBackArrowIcon />
    <span class="nav-back__label">{{ t('nav.back') }}</span>
  </button>
</template>
