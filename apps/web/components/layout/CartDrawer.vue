<script setup lang="ts">
import { formatCop } from '~/utils/format';

const { open, closeCart } = useCartDrawer();
const cart = useCartStore();
const { t } = useLocale();

onMounted(() => cart.hydrate());

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeCart();
}

function clearCart() {
  if (confirm(t('cart.clearConfirm'))) cart.clear();
}
</script>

<template>
  <Teleport to="body">
    <div
      id="cart-overlay"
      :class="{ open }"
      :aria-hidden="!open"
      @click="onOverlayClick"
    />
    <aside
      id="cart-drawer"
      :class="{ open }"
      :aria-hidden="!open"
      role="dialog"
      aria-modal="true"
      :aria-label="t('cart.title')"
    >
      <header class="cart-header">
        <div>
          <h2 class="cart-title">{{ t('cart.title') }}</h2>
          <p class="cart-subtitle">{{ t('cart.subtitle') }}</p>
        </div>
        <button type="button" class="cart-close" :aria-label="t('cart.close')" @click="closeCart">×</button>
      </header>

      <div id="cart-body" class="cart-body">
        <p v-if="!cart.items.length" class="cart-empty">{{ t('cart.empty') }}</p>
        <LayoutCartDrawerItem
          v-for="item in cart.items"
          :key="item.watchId"
          :item="item"
        />
      </div>

      <footer v-if="cart.items.length" id="cart-footer" class="cart-footer">
        <p class="cart-total">{{ t('cart.total') }}: <strong>{{ formatCop(cart.subtotal) }}</strong></p>
        <NuxtLink to="/checkout" class="cart-whatsapp-btn" @click="closeCart">{{ t('cart.checkout') }}</NuxtLink>
        <button type="button" class="cart-clear" @click="clearCart">{{ t('cart.clear') }}</button>
      </footer>
    </aside>
  </Teleport>
</template>
