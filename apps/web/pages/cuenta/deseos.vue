<script setup lang="ts">
import { formatCop } from '~/utils/format';

definePageMeta({ middleware: ['auth'], layout: 'account' });

const wishlist = useWishlistStore();
await wishlist.fetch();
</script>

<template>
  <div>
    <AccountAccountNav />
    <UiSectionHeader label="Mi cuenta" title="Lista de deseos" />
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <article v-for="item in wishlist.items" :key="item.id" class="border border-lux-gold/15 overflow-hidden">
        <NuxtLink :to="`/producto/${item.watch.slug}`">
          <img v-if="item.watch.frontImageUrl" :src="item.watch.frontImageUrl" :alt="item.watch.model" class="w-full aspect-square object-contain bg-lux-black-2 p-4" />
          <div class="p-4 border-t border-lux-gold/10">
            <p class="text-xs text-lux-gold uppercase tracking-widest">{{ item.watch.brand.name }}</p>
            <h3 class="font-display text-xl">{{ item.watch.model }}</h3>
            <p class="text-lux-gold mt-2">{{ formatCop(item.watch.retailPrice) }}</p>
          </div>
        </NuxtLink>
        <button type="button" class="w-full py-2 text-xs uppercase tracking-widest text-lux-white-dim hover:text-red-400" @click="wishlist.toggle(item.watchId)">Quitar</button>
      </article>
    </div>
    <p v-if="!wishlist.items.length" class="text-lux-white-dim">Marca relojes con el corazón en el catálogo.</p>
  </div>
</template>
