<script setup lang="ts">
import { WHOLESALE_BANNER } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const cart = useCartStore();

onMounted(() => cart.hydrate());

useSeoMeta({ title: 'Carrito — LUXTIMEE' });
</script>

<template>
  <div class="px-6 md:px-16 py-12 max-w-4xl mx-auto">
    <UiSectionHeader label="Compra" title="Tu carrito" />

    <p class="mb-6 text-sm text-lux-white-dim">
      {{ WHOLESALE_BANNER }}
      <NuxtLink to="/mayoristas" class="text-lux-gold">Ver mayoristas →</NuxtLink>
    </p>

    <div v-if="!cart.items.length" class="text-center py-20 text-lux-white-dim">
      <p class="mb-6">Tu carrito está vacío.</p>
      <NuxtLink to="/catalogo"><UiLuxButton>Ir al catálogo</UiLuxButton></NuxtLink>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="item in cart.items"
        :key="item.watchId"
        class="flex gap-4 border border-lux-gold/15 p-4 bg-lux-black-2"
      >
        <img v-if="item.productImage" :src="item.productImage" :alt="item.productName" class="w-24 h-24 object-contain bg-lux-black-3" />
        <div class="flex-1">
          <h3 class="font-display text-xl">{{ item.productName }}</h3>
          <p class="text-lux-gold font-display text-lg mt-1">{{ formatCop(cart.unitPrice(item)) }}</p>
          <div class="flex items-center gap-3 mt-3">
            <button type="button" class="w-8 h-8 border border-lux-gold/30" @click="cart.setQuantity(item.watchId, item.quantity - 1)">−</button>
            <span>{{ item.quantity }}</span>
            <button type="button" class="w-8 h-8 border border-lux-gold/30" @click="cart.setQuantity(item.watchId, item.quantity + 1)">+</button>
            <button type="button" class="ml-auto text-xs uppercase tracking-widest text-lux-white-dim hover:text-red-400" @click="cart.remove(item.watchId)">Quitar</button>
          </div>
        </div>
      </article>

      <div class="border-t border-lux-gold/20 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm text-lux-white-dim">Subtotal al detal</p>
          <p class="font-display text-3xl text-lux-gold">{{ formatCop(cart.subtotal) }}</p>
          <UiLuxBadge tone="detal">DETAL</UiLuxBadge>
        </div>
        <NuxtLink to="/checkout"><UiLuxButton>Ir al checkout</UiLuxButton></NuxtLink>
      </div>
    </div>
  </div>
</template>
