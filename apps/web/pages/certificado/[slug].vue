<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const api = useApi();

interface CertPublic {
  slug: string;
  qrPayload: string;
  issuedAt: string;
  customerName: string;
  orderReadableId: string;
  paidAt: string | null;
  watch: { brand: string; model: string; image: string | null };
  warranty: Record<string, unknown>;
}

const { data: cert, error } = await useAsyncData(`cert-${slug.value}`, () =>
  api.get<CertPublic>(`/certificates/public/${slug.value}`),
);

if (error.value || !cert.value) {
  throw createError({ statusCode: 404, message: 'Certificado no encontrado' });
}

useSeoMeta({ title: `Certificado ${cert.value?.watch.model} — Luxtime`, robots: 'index,follow' });
</script>

<template>
  <div v-if="cert" class="min-h-screen bg-lux-black px-6 py-24 flex items-center justify-center">
    <article class="max-w-lg w-full border border-lux-gold/30 p-8 text-center">
      <p class="text-[10px] uppercase tracking-[0.4em] text-lux-gold mb-4">Certificado de autenticidad</p>
      <img v-if="cert.qrPayload" :src="cert.qrPayload" alt="QR certificado" class="w-40 h-40 mx-auto mb-6 bg-white p-2" />
      <img v-if="cert.watch.image" :src="cert.watch.image" :alt="cert.watch.model" class="max-h-48 mx-auto object-contain mb-6" />
      <h1 class="font-display text-3xl mb-2">{{ cert.watch.brand }} {{ cert.watch.model }}</h1>
      <p class="text-sm text-lux-white-dim mb-1">Cliente: {{ cert.customerName }}</p>
      <p class="text-sm text-lux-white-dim mb-1">Pedido: {{ cert.orderReadableId }}</p>
      <p v-if="cert.paidAt" class="text-sm text-lux-white-dim mb-4">Fecha de venta: {{ new Date(cert.paidAt).toLocaleDateString('es-CO') }}</p>
      <p class="text-xs text-lux-gold uppercase tracking-widest">Documento inmutable · Luxtime</p>
    </article>
  </div>
</template>
