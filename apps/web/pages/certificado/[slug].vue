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

const loaded = ref(false);
const showContent = ref(false);

const { data: cert, error } = await useAsyncData(`cert-${slug.value}`, () =>
  api.get<CertPublic>(`/certificates/public/${slug.value}`),
);

if (error.value || !cert.value) {
  throw createError({ statusCode: 404, message: 'Certificado no encontrado' });
}

const warrantyStatus = computed(() => {
  if (!cert.value?.paidAt) return { text: 'Activa', active: true };
  const paid = new Date(cert.value.paidAt);
  const months = Number(cert.value.warranty?.durationMonths) || 12;
  const end = new Date(paid);
  end.setMonth(end.getMonth() + months);
  const active = end > new Date();
  return { text: active ? 'Vigente (VIP)' : 'Expirada', active };
});

const issueDate = computed(() => {
  const d = cert.value?.paidAt || cert.value?.issuedAt;
  return d ? new Date(d).toLocaleDateString('es-CO') : '—';
});

useSeoMeta({ title: `Certificado ${cert.value?.watch.model} — Luxtime`, robots: 'index,follow' });

definePageMeta({ layout: false });

onMounted(() => {
  setTimeout(() => {
    loaded.value = true;
    setTimeout(() => { showContent.value = true; }, 400);
  }, 1200);
});
</script>

<template>
  <div class="min-h-screen bg-lux-black">
    <div v-if="!loaded" class="vault-loader">
      <p class="font-display text-2xl tracking-[0.3em] text-lux-gold uppercase">Luxtime Vault</p>
      <div class="vault-loader-bar" />
    </div>

    <div v-else-if="cert && showContent" class="vault-container">
      <article class="vault-card">
        <p class="vault-badge">Certificado de Autenticidad</p>
        <p class="text-sm text-lux-white-dim mb-2">Pieza registrada exclusivamente para</p>
        <p class="font-display text-2xl text-lux-white mb-6">{{ cert.customerName }}</p>

        <div class="vault-image-box">
          <img v-if="cert.watch.image" :src="cert.watch.image" :alt="cert.watch.model">
        </div>

        <table class="vault-details">
          <tbody>
            <tr>
              <td>Modelo</td>
              <td>{{ cert.watch.brand }} {{ cert.watch.model }}</td>
            </tr>
            <tr>
              <td>Colección</td>
              <td>Luxtime</td>
            </tr>
            <tr>
              <td>Referencia</td>
              <td>{{ cert.orderReadableId }}</td>
            </tr>
            <tr>
              <td>Código Serial</td>
              <td class="vault-serial">{{ cert.slug }}</td>
            </tr>
            <tr>
              <td>Fecha</td>
              <td>{{ issueDate }}</td>
            </tr>
            <tr>
              <td>Garantía</td>
              <td :class="{ 'vault-warranty-active': warrantyStatus.active }">{{ warrantyStatus.text }}</td>
            </tr>
          </tbody>
        </table>

        <img v-if="cert.qrPayload" :src="cert.qrPayload" alt="QR" class="w-32 h-32 mx-auto mt-8 bg-white p-2">
      </article>
    </div>
  </div>
</template>
