<script setup lang="ts">
import { formatCop } from '~/utils/format';

const { open, channel, closeCart } = useCartDrawer();
const retailCart = useCartStore();
const wholesaleCart = useWholesaleCartStore();
const { t } = useLocale();
const { confirm } = useConfirm();

const activeCart = computed(() => (channel.value === 'wholesale' ? wholesaleCart : retailCart));
const isWholesale = computed(() => channel.value === 'wholesale');

const drawerTitle = computed(() => (
  isWholesale.value ? t('cart.wholesaleDrawerTitle') : t('cart.title')
));
const drawerSubtitle = computed(() => (
  isWholesale.value ? t('cart.wholesaleDrawerSubtitle') : t('cart.subtitle')
));
const emptyMessage = computed(() => (
  isWholesale.value ? t('cart.wholesaleDrawerEmpty') : t('cart.empty')
));
const checkoutPath = computed(() => (
  isWholesale.value ? '/mayoristas/checkout' : '/checkout'
));

onMounted(() => {
  retailCart.hydrate();
  wholesaleCart.hydrate();
});

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeCart();
}

async function clearCart() {
  const ok = await confirm({
    title: isWholesale.value ? t('cart.wholesaleClearConfirm') : t('cart.clearConfirm'),
    message: isWholesale.value ? t('cart.wholesaleClearConfirmBody') : t('cart.clearConfirmBody'),
    confirmLabel: isWholesale.value ? t('cart.wholesaleClearConfirmYes') : t('cart.clearConfirmYes'),
    cancelLabel: isWholesale.value ? t('cart.wholesaleClearConfirmNo') : t('cart.clearConfirmNo'),
  });
  if (ok) activeCart.value.clear();
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
      :aria-label="drawerTitle"
    >
      <header class="cart-header">
        <div>
          <h2 class="cart-title">{{ drawerTitle }}</h2>
          <p class="cart-subtitle">{{ drawerSubtitle }}</p>
        </div>
        <button type="button" class="cart-close" :aria-label="t('cart.close')" @click="closeCart">×</button>
      </header>

      <div id="cart-body" class="cart-body">
        <p v-if="!activeCart.items.length" class="cart-empty">{{ emptyMessage }}</p>
        <LayoutCartDrawerItem
          v-for="item in activeCart.items"
          :key="item.watchId"
          :item="item"
          :channel="channel"
        />
      </div>

      <footer v-if="activeCart.items.length" id="cart-footer" class="cart-footer">
        <p class="cart-total">{{ t('cart.total') }}: <strong>{{ formatCop(activeCart.subtotal) }}</strong></p>
        <NuxtLink :to="checkoutPath" class="cart-whatsapp-btn" @click="closeCart">{{ isWholesale ? t('cart.wholesaleDrawerCheckout') : t('cart.checkout') }}</NuxtLink>
        <button type="button" class="cart-clear" @click="clearCart">{{ isWholesale ? t('cart.wholesaleDrawerClear') : t('cart.clear') }}</button>
      </footer>
    </aside>
  </Teleport>
</template>
