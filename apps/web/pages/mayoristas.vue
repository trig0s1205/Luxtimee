<script setup lang="ts">
const { openChat } = useWhatsApp();

const plans = [
  {
    num: '01',
    title: 'Plan Esencial',
    volume: 'Mín. 6 u.',
    features: ['Solo relojes', 'Sin cajas de presentación', 'Precio mayorista'],
    cta: 'Cotizar Esencial',
    featured: false,
  },
  {
    num: '02',
    title: 'Kit Corporativo',
    volume: 'Mín. 6 u.',
    features: ['Relojes + Caja Luxury', 'Almohadilla interior', 'Batería de repuesto'],
    cta: 'Cotizar Kit',
    featured: false,
  },
  {
    num: '03',
    title: 'Solución Llave en Mano',
    volume: 'Mín. 6 u.',
    features: ['Kit completo', 'Paño microfibra', 'Solución limpiadora', 'Full Élite'],
    cta: 'Cotizar Full Élite',
    featured: true,
  },
];

async function cotizar(plan: string) {
  await openChat(`Hola Luxtime, deseo cotizar el plan: ${plan} (mayorista, mín. 6 unidades).`);
}

useSeoMeta({ title: 'Socios Estratégicos — Luxtime' });
</script>

<template>
  <div class="mayoristas-page">
    <header class="brand-header">
      <NuxtLink to="/" class="brand-logo">LUXTIME</NuxtLink>
    </header>

    <section class="manifesto-section reveal">
      <p class="manifesto-tag">Ecosistema Mayorista</p>
      <h1>Un puente hacia tu propia grandeza comercial</h1>
      <p class="section-body" style="max-width:600px;margin:0 auto">
        Accede a nuestro catálogo de alta relojería con condiciones exclusivas para emprendedores y distribuidores en Colombia.
      </p>
    </section>

    <div class="plans-grid">
      <article
        v-for="plan in plans"
        :key="plan.num"
        class="plan-card reveal"
        :class="{ featured: plan.featured }"
      >
        <p class="plan-num">[{{ plan.num }}]</p>
        <h2 class="plan-title">{{ plan.title }}</h2>
        <p class="plan-volume">{{ plan.volume }}</p>
        <ul class="plan-features">
          <li v-for="f in plan.features" :key="f">{{ f }}</li>
        </ul>
        <button
          type="button"
          :class="plan.featured ? 'btn-primary' : 'btn-ghost'"
          @click="cotizar(plan.title)"
        >
          {{ plan.cta }}
        </button>
      </article>
    </div>

    <section class="bespoke-block reveal">
      <h3 class="section-title" style="font-size:clamp(24px,3vw,36px)">¿Buscas una pieza fuera de catálogo?</h3>
      <button type="button" class="btn-ghost mt-6" @click="cotizar('Pieza Exclusiva')">Consultar Pieza Exclusiva →</button>
    </section>

    <div class="disclaimer-box reveal">
      <h3 class="section-title" style="font-size:22px;margin-bottom:12px">Políticas de Blindaje y Exclusividad VIP</h3>
      <p class="section-body" style="max-width:none">
        Los precios mayoristas no se publican en web. Los socios mayoristas quedan excluidos de promociones de sorteos al público general.
        Cada orden requiere un mínimo de 6 unidades.
      </p>
    </div>
  </div>
</template>
