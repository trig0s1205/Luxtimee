<script setup lang="ts">
import { formatCop } from '~/utils/format';

const { open, closeCart } = useCartDrawer();
const cart = useCartStore();
const { t } = useLocale();
const showClearConfirm = ref(false);

onMounted(() => cart.hydrate());

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeCart();
}

function clearCart() {
  showClearConfirm.value = true;
}

function confirmClearCart() {
  cart.clear();
  showClearConfirm.value = false;
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

    <div v-if="showClearConfirm" class="cart-confirm-overlay" @click.self="showClearConfirm = false">
      <div class="cart-confirm-card" role="dialog" aria-modal="true" :aria-label="t('cart.clearConfirm')">
        <p class="cart-confirm-title">{{ t('cart.clearConfirm') }}</p>
        <p class="cart-confirm-text">{{ t('cart.clearConfirmBody') }}</p>
        <div class="cart-confirm-actions">
          <button type="button" class="cart-confirm-cancel" @click="showClearConfirm = false">
            {{ t('cart.clearConfirmNo') }}
          </button>
          <button type="button" class="cart-confirm-accept" @click="confirmClearCart">
            {{ t('cart.clearConfirmYes') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cart-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
}

.cart-confirm-card {
  width: min(100%, 380px);
  padding: 24px;
  border: var(--border-hairline);
  background: var(--black-2, #111);
  text-align: center;
}

.cart-confirm-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--gold);
}

.cart-confirm-text {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--white-dim);
}

.cart-confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.cart-confirm-cancel,
.cart-confirm-accept {
  padding: 10px 18px;
  border: var(--border-hairline);
  background: transparent;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.cart-confirm-cancel {
  color: var(--white-dim);
}

.cart-confirm-accept {
  color: var(--gold);
}

.cart-confirm-accept:hover {
  border-color: rgba(200, 169, 110, 0.35);
}
</style>
