<script setup lang="ts">
import type { CartItemDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';

const props = defineProps<{
  item: CartItemDto;
}>();

const cart = useCartStore();
</script>

<template>
  <article class="cart-item">
    <div class="cart-item-img">
      <img v-if="item.productImage" :src="item.productImage" :alt="item.productName" loading="lazy">
    </div>
    <div class="cart-item-info">
      <p class="cart-item-name">{{ item.productName }}</p>
      <p class="cart-item-price">{{ formatCop(cart.unitPrice(item)) }}</p>
      <div class="cart-qty">
        <button type="button" class="qty-btn" @click="cart.setQuantity(item.watchId, item.quantity - 1)">−</button>
        <span>{{ item.quantity }}</span>
        <button type="button" class="qty-btn" @click="cart.setQuantity(item.watchId, item.quantity + 1)">+</button>
      </div>
    </div>
    <button type="button" class="cart-remove" @click="cart.remove(item.watchId)">×</button>
  </article>
</template>
