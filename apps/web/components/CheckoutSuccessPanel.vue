<script setup lang="ts">
import QRCode from 'qrcode';

const props = defineProps<{
  whatsappUrl: string;
  orderId?: string;
}>();

const copied = ref(false);
const qrDataUrl = ref('');
const isMobile = ref(false);

const handoffUrl = computed(() => buildMobileHandoffUrl(props.whatsappUrl));

async function generateQr() {
  if (!import.meta.client || isMobile.value || !handoffUrl.value) return;
  try {
    qrDataUrl.value = await QRCode.toDataURL(handoffUrl.value, {
      width: 240,
      margin: 2,
      color: { dark: '#141414', light: '#FFFFFF' },
    });
  } catch {
    qrDataUrl.value = '';
  }
}

function openOnMobile() {
  if (!props.whatsappUrl) return;
  launchWhatsAppCheckout(props.whatsappUrl);
}

function openOnDesktop() {
  if (!props.whatsappUrl) return;
  openWhatsAppDesktopApp(props.whatsappUrl);
}

async function copyLink() {
  if (!import.meta.client) return;
  try {
    await navigator.clipboard.writeText(handoffUrl.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2500);
  } catch {
    /* noop */
  }
}

onMounted(() => {
  isMobile.value = isMobileBrowser();
  void generateQr();
});

watch(handoffUrl, () => {
  void generateQr();
});
</script>

<template>
  <div class="checkout-success">
    <p class="checkout-success__badge">Pedido registrado</p>
    <h2 class="checkout-success__title">Ya tenemos tu intención de compra</h2>
    <p v-if="orderId" class="checkout-success__id">Referencia: {{ orderId }}</p>

    <template v-if="isMobile">
      <p class="checkout-success__body">
        Si WhatsApp no se abrió, pulsa el botón para continuar con tu pedido.
      </p>
      <div class="checkout-success__actions">
        <UiLuxButton type="button" class="w-full" @click="openOnMobile">
          Abrir WhatsApp
        </UiLuxButton>
      </div>
    </template>

    <template v-else>
      <p class="checkout-success__body">
        Escanea el código con la <strong>cámara de tu celular</strong>.
        Se abrirá WhatsApp en tu teléfono con el mensaje del pedido listo para enviar.
      </p>

      <div v-if="qrDataUrl" class="checkout-success__qr-wrap">
        <img :src="qrDataUrl" alt="QR para abrir WhatsApp en el celular" class="checkout-success__qr">
      </div>

      <div class="checkout-success__actions">
        <button type="button" class="checkout-success__copy" @click="copyLink">
          {{ copied ? 'Enlace copiado' : 'Copiar enlace para el celular' }}
        </button>
      </div>

      <details class="checkout-success__desktop-opt">
        <summary>¿Tienes WhatsApp instalado en este computador?</summary>
        <p>Úsalo solo si usas WhatsApp Desktop. Si tu WhatsApp está en el celular, escanea el QR de arriba.</p>
        <UiLuxButton type="button" variant="ghost" class="w-full" @click="openOnDesktop">
          Abrir WhatsApp en este PC
        </UiLuxButton>
      </details>
    </template>

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
  max-width: 440px;
  margin: 0 auto 1.5rem;
}

.checkout-success__body strong {
  color: var(--white);
  font-weight: 600;
}

.checkout-success__qr-wrap {
  display: inline-flex;
  padding: 14px;
  margin-bottom: 1.25rem;
  background: #fff;
  border: 1px solid rgba(200, 169, 110, 0.35);
}

.checkout-success__qr {
  display: block;
  width: 240px;
  height: 240px;
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

.checkout-success__desktop-opt {
  margin-top: 1.5rem;
  max-width: 420px;
  margin-inline: auto;
  text-align: left;
  font-size: 13px;
  color: var(--white-dim);
}

.checkout-success__desktop-opt summary {
  cursor: pointer;
  color: var(--gold);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.checkout-success__desktop-opt p {
  margin-bottom: 0.75rem;
  line-height: 1.6;
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
