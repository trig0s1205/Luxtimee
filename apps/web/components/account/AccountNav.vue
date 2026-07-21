<script setup lang="ts">
const route = useRoute();
const { t } = useLocale();

const links = computed(() => [
  { to: '/cuenta', label: t('account.summary') },
  { to: '/cuenta/pedidos', label: t('account.orders') },
  { to: '/cuenta/garantias', label: t('account.warranties') },
  { to: '/cuenta/deseos', label: t('account.wishlist') },
  { to: '/cuenta/datos', label: t('account.shipping') },
]);
</script>

<template>
  <nav class="flex flex-wrap gap-4 mb-10 border-b border-lux-gold/15 pb-4">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="text-[11px] uppercase tracking-widest pb-2 border-b-2 transition-colors"
      :class="route.path === link.to ? 'text-lux-gold border-lux-gold' : 'text-lux-white-dim border-transparent hover:text-lux-white'"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
