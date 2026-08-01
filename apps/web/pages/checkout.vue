<script setup lang="ts">
import type { CreatePreOrderDto, LegalDocumentsDto, ShippingZoneDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { STOREFRONT_CACHE_MS } from '~/utils/storefront-cache';

const cart = useCartStore();
const api = useApi();
const analytics = useAnalytics();

const form = reactive({
  customerName: '',
  customerAddress: '',
  customerPhone: '',
  shippingZoneId: '',
  consentAccepted: false,
});

const loading = ref(false);
const error = ref('');

const { data: zones } = await useCachedAsyncData('shipping-zones', () =>
  api.get<ShippingZoneDto[]>('/shipping-zones/public').catch(() => []),
  { staleTime: STOREFRONT_CACHE_MS.static },
);
const { data: legal } = await useCachedAsyncData('legal-docs', () =>
  api.get<LegalDocumentsDto>('/settings/legal/public'),
  { staleTime: STOREFRONT_CACHE_MS.static },
);

const shippingCost = computed(() => {
  const zone = zones.value?.find((z) => z.id === form.shippingZoneId);
  return zone?.cost ?? 0;
});

const total = computed(() => cart.subtotal + shippingCost.value);

onMounted(() => {
  cart.hydrate();
});

useSeoMeta({ title: 'Checkout — Luxtime' });

async function submit() {
  error.value = '';
  if (!cart.items.length) {
    error.value = 'El carrito está vacío';
    return;
  }
  if (!form.consentAccepted) {
    error.value = 'Debe aceptar términos y política de datos';
    return;
  }
  loading.value = true;
  try {
    const payload: CreatePreOrderDto = {
      ...form,
      items: cart.toCheckoutItems(),
    };
    const res = await api.post<{ whatsappUrl: string }>('/pre-orders', payload);
    analytics.track('checkout_complete', { total: total.value });
    cart.clear();
    if (import.meta.client && res.whatsappUrl) {
      window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear el pre-pedido';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="px-6 md:px-16 py-12 max-w-2xl mx-auto">
    <UiSectionHeader label="Intención de compra" title="Checkout" />

    <div v-if="!cart.items.length" class="text-center py-16 text-lux-white-dim">
      No hay productos en el carrito.
      <NuxtLink to="/catalogo" class="block mt-4 text-lux-gold">Volver al catálogo</NuxtLink>
    </div>

    <form v-else class="checkout-form space-y-5" autocomplete="on" @submit.prevent="submit">
      <UiLuxInput
        id="checkout-name"
        v-model="form.customerName"
        name="name"
        autocomplete="name"
        placeholder="Nombre completo"
        required
      />
      <UiLuxInput
        id="checkout-address"
        v-model="form.customerAddress"
        name="street-address"
        autocomplete="street-address"
        placeholder="Dirección de entrega"
        required
      />
      <UiLuxInput
        id="checkout-phone"
        v-model="form.customerPhone"
        name="tel"
        type="tel"
        autocomplete="tel"
        placeholder="Teléfono / WhatsApp"
        required
      />

      <label class="block text-xs uppercase tracking-widest text-lux-white-dim" for="checkout-shipping">Zona de envío</label>
      <select
        id="checkout-shipping"
        v-model="form.shippingZoneId"
        name="shipping-zone"
        autocomplete="shipping address-level2"
        required
        class="w-full bg-lux-black-2 border border-lux-gold/20 px-4 py-3 text-sm"
      >
        <option value="" disabled>Seleccione zona</option>
        <option v-for="zone in zones" :key="zone.id" :value="zone.id">
          {{ zone.name }} — {{ formatCop(zone.cost) }}
        </option>
      </select>

      <div class="border border-lux-gold/15 p-4 text-sm space-y-2">
        <p>Subtotal: {{ formatCop(cart.subtotal) }}</p>
        <p>Envío: {{ formatCop(shippingCost) }}</p>
        <p class="font-display text-xl text-lux-gold">Total: {{ formatCop(total) }}</p>
        <p class="text-xs text-lux-white-dim">Envíos nacionales: pago total + envío al confirmar.</p>
      </div>

      <UiLuxCheckbox v-model="form.consentAccepted">
        Acepto los Términos y Condiciones y la Política de Tratamiento de Datos (Ley 1581 de 2012).
      </UiLuxCheckbox>
      <details v-if="legal" class="text-xs text-lux-white-dim">
        <summary class="cursor-pointer mb-2">Ver borradores legales</summary>
        <p class="mb-2">{{ legal.termsDraft }}</p>
        <p>{{ legal.privacyDraft }}</p>
      </details>

      <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

      <UiLuxButton type="submit" class="w-full" :disabled="loading">
        {{ loading ? 'Procesando…' : 'Comprar por WhatsApp' }}
      </UiLuxButton>
    </form>
  </div>
</template>
