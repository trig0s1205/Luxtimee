<script setup lang="ts">
const props = defineProps<{
  whatsappUrl: string;
  orderId?: string;
}>();

const copied = ref(false);
const popupBlocked = ref(false);

const launchUrl = computed(() => resolveWhatsAppLaunchUrl(props.whatsappUrl));

function openWhatsApp() {
  if (!import.meta.client || !props.whatsappUrl) return;

  if (isMobileBrowser()) {
    launchWhatsAppCheckout(props.whatsappUrl);
    return;
  }

  const result = openWhatsAppInNewTab(props.whatsappUrl);
  popupBlocked.value = !!result.blocked;
}

async function copyLink() {
  if (!import.meta.client) return;
  try {
    await navigator.clipboard.writeText(launchUrl.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2500);
  } catch {
    /* noop */
  }
}
</script>

<template>
  <div class="checkout-success">
    <p class="checkout-success__badge">Pedido registrado</p>
    <h2 class="checkout-success__title">Ya tenemos tu intención de compra</h2>
    <p v-if="orderId" class="checkout-success__id">Referencia: {{ orderId }}</p>
    <p class="checkout-success__body">
      {{ isMobileBrowser()
        ? 'Si WhatsApp no se abrió, usa el botón de abajo.'
        : 'WhatsApp Web debería haberse abierto en otra pestaña. Si la cerraste o el navegador la bloqueó, usa el botón de abajo.' }}
    </p>

    <div class="checkout-success__actions">
      <UiLuxButton type="button" class="w-full" @click="openWhatsApp">
        Abrir WhatsApp
      </UiLuxButton>
      <button type="button" class="checkout-success__copy" @click="copyLink">
        {{ copied ? 'Enlace copiado' : 'Copiar enlace' }}
      </button>
    </div>

    <p v-if="popupBlocked" class="checkout-success__hint">
      El navegador bloqueó la ventana. Permite popups para este sitio o pulsa «Abrir WhatsApp».
    </p>

    <NuxtLink to="/catalogo" class="checkout-success__back">← Seguir explorando</NuxtLink>
  </div>
</template>

<style scoped>
.checkout-success {
  text-align: center;
  padding: 2rem 0;
}

.checkout-success__badge {
  font-size: 10px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 1rem;
}

.checkout-success__title {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 300;
  color: var(--white);
  margin-bottom: 0.75rem;
}

.checkout-success__id {
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--white-dim);
  margin-bottom: 1rem;
}

.checkout-success__body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--white-dim);
  max-width: 420px;
  margin: 0 auto 1.75rem;
}

.checkout-success__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 360px;
  margin: 0 auto;
}

.checkout-success__copy {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-dim);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}

.checkout-success__copy:hover {
  color: var(--gold);
}

.checkout-success__hint {
  margin-top: 1rem;
  font-size: 13px;
  color: var(--gold);
  line-height: 1.5;
}

.checkout-success__back {
  display: inline-block;
  margin-top: 2rem;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--white-dim);
  text-decoration: none;
}

.checkout-success__back:hover {
  color: var(--gold);
}
</style>
