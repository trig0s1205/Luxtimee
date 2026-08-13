<script setup lang="ts">
const props = defineProps<{
  whatsappUrl: string;
  orderId?: string;
}>();

const emit = defineEmits<{
  open: [];
}>();

const copied = ref(false);
const blocked = ref(false);

function openWhatsApp() {
  if (!import.meta.client || !props.whatsappUrl) return;

  if (isMobileBrowser()) {
    window.location.href = props.whatsappUrl;
    emit('open');
    return;
  }

  const popup = window.open(props.whatsappUrl, '_blank', 'noopener,noreferrer');
  if (!popup) {
    blocked.value = true;
    return;
  }
  emit('open');
}

async function copyLink() {
  if (!import.meta.client) return;
  try {
    await navigator.clipboard.writeText(props.whatsappUrl);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2500);
  } catch {
    blocked.value = true;
  }
}
</script>

<template>
  <div class="checkout-success">
    <p class="checkout-success__badge">Pedido registrado</p>
    <h2 class="checkout-success__title">Ya tenemos tu intención de compra</h2>
    <p v-if="orderId" class="checkout-success__id">Referencia: {{ orderId }}</p>
    <p class="checkout-success__body">
      Tu pedido quedó guardado. Abre WhatsApp para confirmar pago y entrega con nuestro equipo.
    </p>

    <div class="checkout-success__actions">
      <UiLuxButton type="button" class="w-full" @click="openWhatsApp">
        Abrir WhatsApp
      </UiLuxButton>
      <button type="button" class="checkout-success__copy" @click="copyLink">
        {{ copied ? 'Enlace copiado' : 'Copiar enlace de WhatsApp' }}
      </button>
    </div>

    <p v-if="blocked" class="checkout-success__fallback">
      Si el navegador bloqueó la ventana, usa el botón de arriba o
      <a :href="whatsappUrl" target="_blank" rel="noopener noreferrer">toca aquí para abrir WhatsApp</a>.
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

.checkout-success__fallback {
  margin-top: 1rem;
  font-size: 13px;
  color: var(--white-dim);
  line-height: 1.6;
}

.checkout-success__fallback a {
  color: var(--gold);
  text-decoration: underline;
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
