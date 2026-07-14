<script setup lang="ts">
const variants = [
  {
    id: 'onyx',
    name: 'Onyx & Oro',
    description: 'Fiel a DIXUS — negro profundo y oro cálido.',
    className: 'variant-onyx',
  },
  {
    id: 'editorial',
    name: 'Editorial Blanco',
    description: 'Lujo claro tipo revista de alta relojería.',
    className: 'variant-editorial',
  },
  {
    id: 'midnight',
    name: 'Midnight Contrast',
    description: 'Tech-lux con acentos metálicos fríos.',
    className: 'variant-midnight',
  },
];
</script>

<template>
  <div>
    <section class="px-6 md:px-16 py-20">
      <UiSectionHeader
        label="Showcase"
        title="Exploración de diseño Luxtime"
      />
      <p class="text-lux-white-dim max-w-2xl mb-10">
        Tres direcciones visuales navegables para que el cliente elija la identidad definitiva.
        Variante activa por defecto del producto: <strong class="text-lux-gold">Onyx & Oro</strong>.
      </p>
      <div class="grid md:grid-cols-3 gap-6">
        <NuxtLink
          v-for="variant in variants"
          :key="variant.id"
          :to="`/design/${variant.id}`"
          class="border border-lux-gold/20 p-8 hover:border-lux-gold transition-colors"
        >
          <p class="text-lux-gold text-xs uppercase tracking-lux mb-2">Variante {{ variant.id }}</p>
          <h3 class="font-display text-3xl mb-3">{{ variant.name }}</h3>
          <p class="text-sm text-lux-white-dim">{{ variant.description }}</p>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
