<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { watchPrimaryImage, watchVideoUrl } from '~/utils/media-url';

defineProps<{ watches: WatchPublicDto[] }>();

const emit = defineEmits<{ select: [watch: WatchPublicDto] }>();
</script>

<template>
  <div class="h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] overflow-y-auto snap-y snap-mandatory scroll-smooth">
    <article
      v-for="watch in watches"
      :key="watch.id"
      class="snap-start min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-8rem)] flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 px-6 py-12 bg-lux-black-2 border-b border-lux-gold/10"
    >
      <div class="flex-1 flex items-center justify-center max-h-[45vh] md:max-h-[60vh]">
        <video
          v-if="watchVideoUrl(watch)"
          :src="watchVideoUrl(watch)"
          class="max-h-full max-w-full object-contain"
          autoplay
          muted
          loop
          playsinline
        />
        <img
          v-else-if="watchPrimaryImage(watch)"
          :src="watchPrimaryImage(watch)"
          :alt="`${watch.brand.name} ${watch.model}`"
          class="max-h-full max-w-full object-contain"
          loading="lazy"
        />
      </div>
      <div class="flex-1 max-w-md text-center md:text-left">
        <p class="text-[10px] uppercase tracking-[0.35em] text-lux-gold mb-3">{{ watch.brand.name }}</p>
        <h2 class="font-display text-4xl md:text-5xl text-lux-white mb-3">{{ watch.model }}</h2>
        <p class="text-sm text-lux-white-dim mb-2">
          {{ watch.movementType }} ·
          <span :class="watch.stock > 0 ? 'text-lux-gold' : 'text-red-400'">
            {{ watch.stock > 0 ? 'Disponible' : 'Agotado' }}
          </span>
        </p>
        <p class="font-display text-3xl text-lux-gold mb-8">{{ formatCop(watch.retailPrice) }}</p>
        <div class="flex flex-wrap gap-3 justify-center md:justify-start">
          <NuxtLink :to="`/producto/${watch.slug}`">
            <UiLuxButton>Ver ficha</UiLuxButton>
          </NuxtLink>
          <UiLuxButton variant="ghost" @click="emit('select', watch)">Añadir al carrito</UiLuxButton>
        </div>
      </div>
    </article>
  </div>
</template>
