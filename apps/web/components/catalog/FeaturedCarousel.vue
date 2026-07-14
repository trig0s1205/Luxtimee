<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

defineProps<{ watches: WatchPublicDto[] }>();
</script>

<template>
  <div class="overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0">
    <div class="flex gap-4 min-w-max">
      <article
        v-for="watch in watches"
        :key="watch.id"
        class="w-72 shrink-0 bg-lux-black-3 border border-lux-gold/10 overflow-hidden group"
      >
        <NuxtLink :to="`/producto/${watch.slug}`" class="block">
          <div class="aspect-[4/5] bg-lux-black-2 flex items-center justify-center overflow-hidden">
            <img
              v-if="watch.frontImageUrl"
              :src="watch.frontImageUrl"
              :alt="`${watch.brand.name} ${watch.model}`"
              class="max-w-[80%] max-h-[80%] object-contain transition-transform duration-500 group-hover:-translate-y-2"
              loading="lazy"
            />
          </div>
          <div class="p-5 border-t border-lux-gold/10">
            <p class="text-[9px] uppercase tracking-[0.3em] text-lux-gold mb-1">{{ watch.brand.name }}</p>
            <h3 class="font-display text-xl text-lux-white mb-2">{{ watch.model }}</h3>
            <p class="font-display text-lg text-lux-gold">{{ formatCop(watch.retailPrice) }}</p>
          </div>
        </NuxtLink>
      </article>
    </div>
  </div>
</template>
